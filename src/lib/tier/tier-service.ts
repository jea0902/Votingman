/**
 * 시장별 통합 통계·MMR 계산 (전체 기간)
 *
 * - 정산된 폴만 참여/당첨 집계 (무효판 제외)
 * - MMR = 보유 코인 × 누적 승률
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { TierMarket } from "@/lib/supabase/db-types";
import type { TierKey } from "@/lib/supabase/db-types";
import { SENTIMENT_TO_TIER_MARKET, TIER_MARKET_ALL } from "./constants";

const TIER_MARKET_FROM_SENTIMENT = SENTIMENT_TO_TIER_MARKET as Record<string, TierMarket>;

export type UserMarketStats = {
  market: TierMarket;
  placement_matches_played: number;
  placement_done: boolean;
  win_count: number;
  total_count: number;
  win_rate: number;
  mmr: number;
  tier: TierKey | null;
  /** 해당 시장 내 상위 몇 % (0~100, 소수 둘째자리) */
  percentile_pct: number | null;
  /** 해당 시장 내 실시간 순위 (1위, 2위, ...) */
  rank: number | null;
};

/**
 * 시장 그룹에 해당하는 정산된 폴 ID 목록 조회 (전체 기간)
 * - payout_history에 1건이라도 있는 폴 = 정산 완료
 * - tierMarket='all': 전체 시장 정산 폴 모두 반환
 */
async function getSettledPollIds(tierMarket: TierMarket): Promise<{ poll_id: string; market: string }[]> {
  const admin = createSupabaseAdmin();

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
 * 한 유저의 시장별 참여 횟수·당첨 횟수 계산 (전체 기간)
 */
async function computeUserMarketStats(
  userId: string,
  tierMarket: TierMarket
): Promise<{
  placement_matches_played: number;
  win_count: number;
  total_count: number;
}> {
  const admin = createSupabaseAdmin();
  const settled = await getSettledPollIds(tierMarket);
  const pollIds = settled.map((s) => s.poll_id);
  if (pollIds.length === 0) {
    return {
      placement_matches_played: 0,
      win_count: 0,
      total_count: 0,
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

  const { data: payouts } = await admin
    .from("payout_history")
    .select("payout_amount, bet_amount")
    .eq("user_id", userId)
    .in("poll_id", participatedPollIds);

  let win_count = 0;
  let loss_count = 0;
  for (const p of payouts ?? []) {
    const payout = Number(p.payout_amount ?? 0);
    const bet = Number(p.bet_amount ?? 0);
    if (payout > 0 && payout !== bet) win_count++;
    else if (payout === 0) loss_count++;
  }
  const total_count = win_count + loss_count;

  return {
    placement_matches_played,
    win_count,
    total_count,
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
 * 한 유저의 시장별 통계 계산 (DB 읽기만, 저장 안 함, 전체 기간)
 */
export async function computeUserStats(userId: string): Promise<UserMarketStats[]> {
  const admin = createSupabaseAdmin();

  const { data: userRow } = await admin
    .from("users")
    .select("voting_coin_balance")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  const balance = Number(userRow?.voting_coin_balance ?? 0);

  const { placement_matches_played, win_count, total_count } =
    await computeUserMarketStats(userId, TIER_MARKET_ALL);

  const hasParticipation = placement_matches_played > 0;
  const win_rate = total_count > 0 ? win_count / total_count : 0;
  const mmr = hasParticipation ? balance * win_rate : 0;

  return [
    {
      market: TIER_MARKET_ALL,
      placement_matches_played,
      placement_done: true,
      win_count,
      total_count,
      win_rate,
      mmr,
      tier: null,
      percentile_pct: null,
      rank: null,
    },
  ];
}

/**
 * 시장별 전체 유저 MMR 계산 후 user_stats upsert (전체 기간)
 */
export async function refreshMarketStats(tierMarket: TierMarket): Promise<{ updated: number }> {
  const admin = createSupabaseAdmin();

  const settled = await getSettledPollIds(tierMarket);
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
    .select("user_id, poll_id, payout_amount, bet_amount")
    .in("poll_id", pollIds);

  const userWins = new Map<string, Set<string>>();
  const userLosses = new Map<string, Set<string>>();
  for (const p of payouts ?? []) {
    if (!p.user_id) continue;
    const payout = Number(p.payout_amount ?? 0);
    const bet = Number(p.bet_amount ?? 0);
    if (payout > 0 && payout !== bet) {
      let set = userWins.get(p.user_id);
      if (!set) {
        set = new Set();
        userWins.set(p.user_id, set);
      }
      set.add(p.poll_id);
    } else if (payout === 0) {
      let set = userLosses.get(p.user_id);
      if (!set) {
        set = new Set();
        userLosses.set(p.user_id, set);
      }
      set.add(p.poll_id);
    }
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
  const now = new Date().toISOString();
  const upsertRows = [...userParticipations.entries()].map(([userId]) => {
    const wins = (userWins.get(userId) ?? new Set()).size;
    const losses = (userLosses.get(userId) ?? new Set()).size;
    const played = wins + losses; // 승+패만 (무효 제외, 승률·전적 표시용)
    const hasParticipation = played > 0;
    const win_rate = played > 0 ? wins / played : 0;
    const balance = balanceByUser.get(userId) ?? 0;
    const mmr = hasParticipation ? balance * win_rate : 0;
    return {
      user_id: userId,
      market: marketKey,
      win_count: wins,
      participation_count: played,
      mmr,
      updated_at: now,
    };
  });

  if (upsertRows.length === 0) return { updated: 0 };

  const { error } = await admin.from("user_stats").upsert(upsertRows, {
    onConflict: "user_id,market",
    ignoreDuplicates: false,
  });
  return { updated: error ? 0 : upsertRows.length };
}

/**
 * 내 MMR·승률 조회 (전체 기간)
 * - 전적·승률: payout_history에서 직접 계산
 * - 승리 판정: payout_amount > 0 && payout_amount != bet_amount
 * - MMR = 보유코인 × 승률
 */
export async function getMyTierStats(userId: string): Promise<{
  markets: UserMarketStats[];
}> {
  const admin = createSupabaseAdmin();

  const computed = await computeUserStats(userId);
  const m = computed[0];
  if (!m) return { markets: [] };

  await admin.from("user_stats").upsert(
    {
      user_id: userId,
      market: TIER_MARKET_ALL,
      win_count: m.win_count,
      participation_count: m.total_count,
      mmr: m.mmr,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,market", ignoreDuplicates: false }
  );

  const markets = await addPercentilesToMarkets(admin, computed);
  return { markets };
}
