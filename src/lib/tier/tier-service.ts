/**
 * 시장별 시즌 통계·MMR 계산
 *
 * - 정산된 폴만 참여/당첨 집계 (무효판 제외)
 * - 시장 그룹: btc | us | kr
 * - MMR = 보유 코인 × 시즌 누적 승률 (이전 시즌 보정 70%~130%)
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { TierMarket } from "@/lib/supabase/db-types";
import type { TierKey } from "@/lib/supabase/db-types";
import {
  getSeasonDateRange,
  getCurrentSeasonId,
  type SeasonId,
} from "@/lib/constants/seasons";
import { SENTIMENT_TO_TIER_MARKET, TIER_MARKET_ALL } from "./constants";

const TIER_MARKET_FROM_SENTIMENT = SENTIMENT_TO_TIER_MARKET as Record<string, TierMarket>;

export type UserMarketStats = {
  market: TierMarket;
  season_id: SeasonId;
  placement_matches_played: number;
  placement_done: boolean;
  season_win_count: number;
  season_total_count: number;
  win_rate: number;
  mmr: number;
  prev_season_mmr: number | null;
  tier: TierKey | null;
  /** 해당 시장 내 상위 몇 % (0~100, 소수 둘째자리) */
  percentile_pct: number | null;
  /** 해당 시장 내 실시간 순위 (1위, 2위, ...) */
  rank: number | null;
};

/**
 * 시즌·시장 그룹에 해당하는 정산된 폴 ID 목록 조회
 * (payout_history에 1건이라도 있는 폴 = 정산 완료, 무효판 제외됨)
 * - tierMarket='all': 전체 시장(btc, ndq, sp500, kospi, kosdaq) 정산 폴 모두 반환
 */
async function getSettledPollIdsInSeason(
  seasonId: SeasonId,
  tierMarket: TierMarket
): Promise<{ poll_id: string; market: string }[]> {
  const admin = createSupabaseAdmin();
  const { start, end } = getSeasonDateRange(seasonId);

  const { data: payouts } = await admin
    .from("payout_history")
    .select("poll_id")
    .not("poll_id", "is", null);

  const distinctPollIds = [...new Set((payouts ?? []).map((p) => p.poll_id))];
  if (distinctPollIds.length === 0) return [];

  const { data: polls } = await admin
    .from("sentiment_polls")
    .select("id, poll_date, market")
    .in("id", distinctPollIds)
    .gte("poll_date", start)
    .lte("poll_date", end)
    .not("market", "is", null);

  const filtered =
    tierMarket === TIER_MARKET_ALL
      ? polls ?? []
      : (polls ?? []).filter((p) => {
          const group = TIER_MARKET_FROM_SENTIMENT[p.market ?? ""];
          return group === tierMarket;
        });

  return filtered.map((p) => ({ poll_id: p.id, market: p.market ?? "" }));
}

/**
 * 한 유저의 시장·시즌별 참여 횟수·당첨 횟수 계산
 */
async function computeUserMarketSeason(
  userId: string,
  tierMarket: TierMarket,
  seasonId: SeasonId
): Promise<{
  placement_matches_played: number;
  season_win_count: number;
  season_total_count: number;
}> {
  const admin = createSupabaseAdmin();
  const settled = await getSettledPollIdsInSeason(seasonId, tierMarket);
  const pollIds = settled.map((s) => s.poll_id);
  if (pollIds.length === 0) {
    return {
      placement_matches_played: 0,
      season_win_count: 0,
      season_total_count: 0,
    };
  }

  const { data: votes } = await admin
    .from("sentiment_votes")
    .select("poll_id")
    .eq("user_id", userId)
    .gt("bet_amount", 0)
    .in("poll_id", pollIds);

  const participatedPollIds = [...new Set((votes ?? []).map((v) => v.poll_id))];
  const placement_matches_played = participatedPollIds.length;

  const { count: winCount } = await admin
    .from("payout_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("poll_id", participatedPollIds);

  return {
    placement_matches_played,
    season_win_count: winCount ?? 0,
    season_total_count: placement_matches_played,
  };
}

/**
 * 시장 내 MMR 보유 유저 중 해당 MMR보다 높은 유저 수 → 순위·상위 % 계산 (user_stats 기준)
 * - rank: MMR보다 높은 유저 수 + 1 (1위, 2위, ...)
 * - percentile_pct: 상위 몇 % (소수 둘째자리)
 */
async function getMarketRankAndPercentile(
  admin: Awaited<ReturnType<typeof createSupabaseAdmin>>,
  market: TierMarket,
  userMmr: number
): Promise<{ rank: number | null; percentile_pct: number | null }> {
  const { count: total } = await admin
    .from("user_stats")
    .select("id", { count: "exact", head: true })
    .eq("market", market)
    .gt("mmr", 0);
  if (total == null || total === 0) return { rank: null, percentile_pct: null };

  const { count: above } = await admin
    .from("user_stats")
    .select("id", { count: "exact", head: true })
    .eq("market", market)
    .gt("mmr", userMmr);
  const rank = (above ?? 0) + 1;
  const pct = ((total - rank) / total) * 100;
  return {
    rank,
    percentile_pct: Math.round(pct * 100) / 100,
  };
}

async function addPercentilesToMarkets(
  admin: Awaited<ReturnType<typeof createSupabaseAdmin>>,
  markets: Omit<UserMarketStats, "percentile_pct" | "rank">[]
): Promise<UserMarketStats[]> {
  return Promise.all(
    markets.map(async (m) => {
      const { rank, percentile_pct } =
        typeof m.mmr === "number" && m.mmr > 0
          ? await getMarketRankAndPercentile(admin, m.market, m.mmr)
          : { rank: null as number | null, percentile_pct: null as number | null };
      return { ...m, percentile_pct, rank };
    })
  );
}

/**
 * 한 유저의 시장별 통계 계산 (DB 읽기만, 저장 안 함)
 * user_stats 사용: 시즌 구분 없이 전체 누적 기준
 */
export async function computeUserStatsForSeason(
  userId: string,
  seasonId: SeasonId = getCurrentSeasonId()
): Promise<UserMarketStats[]> {
  const admin = createSupabaseAdmin();

  const { data: userRow } = await admin
    .from("users")
    .select("voting_coin_balance")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  const balance = Number(userRow?.voting_coin_balance ?? 0);

  const { placement_matches_played, season_win_count, season_total_count } =
    await computeUserMarketSeason(userId, TIER_MARKET_ALL, seasonId);

  const hasParticipation = placement_matches_played > 0;
  const win_rate =
    season_total_count > 0 ? season_win_count / season_total_count : 0;
  const mmr = hasParticipation ? balance * win_rate : 0;

  return [
    {
      market: TIER_MARKET_ALL,
      season_id: seasonId,
      placement_matches_played,
      placement_done: true,
      season_win_count,
      season_total_count,
      win_rate,
      mmr,
      prev_season_mmr: null,
      tier: null,
      percentile_pct: null,
      rank: null,
    },
  ];
}

/**
 * 시장별 전체 유저 MMR 계산 후 user_stats upsert
 */
export async function refreshMarketSeason(
  tierMarket: TierMarket,
  seasonId: SeasonId
): Promise<{ updated: number }> {
  const admin = createSupabaseAdmin();

  const settled = await getSettledPollIdsInSeason(seasonId, tierMarket);
  const pollIds = settled.map((s) => s.poll_id);
  if (pollIds.length === 0) {
    return { updated: 0 };
  }

  const { data: votes } = await admin
    .from("sentiment_votes")
    .select("user_id, poll_id")
    .in("poll_id", pollIds)
    .gt("bet_amount", 0);

  const userParticipations = new Map<string, Set<string>>();
  for (const v of votes ?? []) {
    if (!v.user_id) continue;
    let set = userParticipations.get(v.user_id);
    if (!set) {
      set = new Set();
      userParticipations.set(v.user_id, set);
    }
    set.add(v.poll_id);
  }

  const { data: payouts } = await admin
    .from("payout_history")
    .select("user_id, poll_id")
    .in("poll_id", pollIds);

  const userWins = new Map<string, Set<string>>();
  for (const p of payouts ?? []) {
    let set = userWins.get(p.user_id);
    if (!set) {
      set = new Set();
      userWins.set(p.user_id, set);
    }
    set.add(p.poll_id);
  }

  const { data: users } = await admin
    .from("users")
    .select("user_id, voting_coin_balance")
    .in("user_id", [...userParticipations.keys()])
    .is("deleted_at", null);

  const balanceByUser = new Map<string, number>();
  for (const u of users ?? []) {
    balanceByUser.set(u.user_id, Number(u.voting_coin_balance ?? 0));
  }

  const marketKey = tierMarket === TIER_MARKET_ALL ? TIER_MARKET_ALL : tierMarket;
  let updated = 0;
  for (const [userId, pollIdSet] of userParticipations) {
    const played = pollIdSet.size;
    const wins = (userWins.get(userId) ?? new Set()).size;
    const hasParticipation = played > 0;
    const win_rate = played > 0 ? wins / played : 0;
    const balance = balanceByUser.get(userId) ?? 0;
    const mmr = hasParticipation ? balance * win_rate : 0;

    const { error } = await admin.from("user_stats").upsert(
      {
        user_id: userId,
        market: marketKey,
        win_count: wins,
        participation_count: played,
        mmr,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,market",
        ignoreDuplicates: false,
      }
    );
    if (!error) updated++;
  }
  return { updated };
}

/**
 * 내 MMR·승률 조회: user_stats 우선, 없으면 계산 후 upsert.
 * 통합 랭킹: market='all' 한 행만 사용.
 */
export async function getMyTierStats(userId: string): Promise<{
  season_id: SeasonId;
  markets: UserMarketStats[];
}> {
  const admin = createSupabaseAdmin();
  const seasonId = getCurrentSeasonId();

  const { data: existing } = await admin
    .from("user_stats")
    .select("market, win_count, participation_count, mmr")
    .eq("user_id", userId)
    .eq("market", TIER_MARKET_ALL)
    .maybeSingle();

  const rowToRaw = (r: { market: string; win_count: number; participation_count: number; mmr: unknown }): Omit<UserMarketStats, "percentile_pct" | "rank"> => ({
    market: r.market as TierMarket,
    season_id: seasonId,
    placement_matches_played: r.participation_count,
    placement_done: true,
    season_win_count: r.win_count,
    season_total_count: r.participation_count,
    win_rate: r.participation_count > 0 ? r.win_count / r.participation_count : 0,
    mmr: Number(r.mmr),
    prev_season_mmr: null,
    tier: null,
  });

  if (existing) {
    const raw = rowToRaw(existing);
    const markets = await addPercentilesToMarkets(admin, [raw]);
    return { season_id: seasonId, markets };
  }

  const computed = await computeUserStatsForSeason(userId, seasonId);
  const m = computed[0];
  if (!m) return { season_id: seasonId, markets: [] };

  await admin.from("user_stats").upsert(
    {
      user_id: userId,
      market: TIER_MARKET_ALL,
      win_count: m.season_win_count,
      participation_count: m.season_total_count,
      mmr: m.mmr,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,market", ignoreDuplicates: false }
  );

  const markets = await addPercentilesToMarkets(admin, computed);
  return { season_id: seasonId, markets };
}
