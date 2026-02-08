/**
 * 보팅맨 통합 랭킹 TOP5 + 유저당 최다배팅 시장 1개 포지션
 * - user_season_stats.market = 'all' 기준 통합 MMR TOP5
 * - 각 유저별 "가장 많이 배팅한 시장" 1개만 표시 (시장명 + 롱/숏 + 배팅 VTC)
 * - 쿼리: ?section= 무시 (통합만 반환). 하위 호환용 section 파라미터는 받지만 사용하지 않음.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getCurrentSeasonId } from "@/lib/constants/seasons";
import { getOrCreateTodayPollByMarket } from "@/lib/sentiment/poll-server";
import { MARKET_LABEL } from "@/lib/constants/sentiment-markets";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";

/** 유저당 1개 시장: 최다배팅 시장의 포지션 */
export type PrimaryPosition = {
  market: string;
  market_label: string;
  choice: "long" | "short";
  bet_amount: number;
};

export type LeaderboardPosition = {
  choice: "long" | "short";
  bet_amount: number;
};

export type LeaderboardTop5Item = {
  rank: number;
  user_id: string;
  nickname: string;
  mmr: number;
  voting_coin_balance: number;
  win_rate: number;
  /** 시장(지수)별 오늘 투표 (하위 호환) */
  positions: Record<string, LeaderboardPosition>;
  /** 유저당 1개: 가장 많이 배팅한 시장 + 롱/숏 + 배팅 VTC */
  primary_position: PrimaryPosition | null;
};

export type LeaderboardTop5Response = {
  section: "all";
  top5: LeaderboardTop5Item[];
};

const ALL_MARKETS: SentimentMarket[] = ["btc", "ndq", "sp500", "kospi", "kosdaq"];

export async function GET() {
  try {
    const admin = createSupabaseAdmin();
    const seasonId = getCurrentSeasonId();

    // 1) 통합 랭킹: market='all' 기준 MMR TOP5
    const { data: statsRows, error: statsError } = await admin
      .from("user_season_stats")
      .select("user_id, mmr, season_win_count, season_total_count")
      .eq("market", "all")
      .eq("season_id", seasonId)
      .order("mmr", { ascending: false })
      .limit(5);

    if (statsError) {
      console.error("Leaderboard top5 user_season_stats error:", statsError);
      return NextResponse.json(
        { success: false, error: { code: "SERVER_ERROR", message: "리더보드를 불러오는데 실패했습니다." } },
        { status: 500 }
      );
    }

    if (!statsRows || statsRows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { section: "all", top5: [] } satisfies LeaderboardTop5Response,
      });
    }

    const userIds = statsRows.map((r) => r.user_id);

    // 2) 닉네임·보팅코인 잔액
    const { data: usersRows, error: usersError } = await admin
      .from("users")
      .select("user_id, nickname, voting_coin_balance")
      .in("user_id", userIds)
      .is("deleted_at", null);

    if (usersError) {
      console.error("Leaderboard top5 users error:", usersError);
      return NextResponse.json(
        { success: false, error: { code: "SERVER_ERROR", message: "리더보드를 불러오는데 실패했습니다." } },
        { status: 500 }
      );
    }

    const userMap = new Map(
      (usersRows ?? []).map((u) => [
        u.user_id,
        {
          nickname: u.nickname ?? "알 수 없음",
          voting_coin_balance: Number(u.voting_coin_balance ?? 0),
        },
      ])
    );

    // 3) 오늘 폴 ID 목록 (전체 시장)
    const pollIdsByMarket: Record<string, string> = {};
    for (const m of ALL_MARKETS) {
      const { poll } = await getOrCreateTodayPollByMarket(m);
      pollIdsByMarket[m] = poll.id;
    }
    const pollIds = Object.values(pollIdsByMarket);

    // 4) TOP5 유저들의 오늘 투표 (poll_id, user_id, choice, bet_amount, market)
    const { data: votesRows, error: votesError } = await admin
      .from("sentiment_votes")
      .select("poll_id, user_id, choice, bet_amount, market")
      .in("user_id", userIds)
      .in("poll_id", pollIds)
      .gt("bet_amount", 0);

    if (votesError) {
      console.error("Leaderboard top5 sentiment_votes error:", votesError);
      return NextResponse.json(
        { success: false, error: { code: "SERVER_ERROR", message: "리더보드를 불러오는데 실패했습니다." } },
        { status: 500 }
      );
    }

    // poll_id → market (vote에 market 없을 수 있으므로 폴에서 보정)
    const { data: pollsRows } = await admin
      .from("sentiment_polls")
      .select("id, market")
      .in("id", pollIds);
    const marketByPollId = new Map((pollsRows ?? []).map((p) => [p.id, p.market ?? ""]));

    const positionsByUserAndMarket = new Map<string, Record<string, LeaderboardPosition>>();
    const betByUserAndMarket = new Map<string, Map<string, { choice: "long" | "short"; bet_amount: number }>>();

    for (const v of votesRows ?? []) {
      if (!v.user_id) continue;
      const market = (v.market as string) || marketByPollId.get(v.poll_id) || "";
      const choice = v.choice as "long" | "short";
      const bet = Number(v.bet_amount ?? 0);

      if (!market) continue;

      let map = positionsByUserAndMarket.get(v.user_id);
      if (!map) {
        map = {};
        positionsByUserAndMarket.set(v.user_id, map);
      }
      map[market] = { choice, bet_amount: bet };

      let byMarket = betByUserAndMarket.get(v.user_id);
      if (!byMarket) {
        byMarket = new Map();
        betByUserAndMarket.set(v.user_id, byMarket);
      }
      const prev = byMarket.get(market);
      if (!prev || bet > prev.bet_amount) {
        byMarket.set(market, { choice, bet_amount: bet });
      }
    }

    // 5) 유저별 최다배팅 시장 1개 → primary_position
    function getPrimaryPosition(userId: string): PrimaryPosition | null {
      const byMarket = betByUserAndMarket.get(userId);
      if (!byMarket || byMarket.size === 0) return null;
      let bestMarket = "";
      let bestBet = 0;
      let bestChoice: "long" | "short" = "long";
      byMarket.forEach((val, m) => {
        if (val.bet_amount > bestBet) {
          bestBet = val.bet_amount;
          bestMarket = m;
          bestChoice = val.choice;
        }
      });
      if (!bestMarket) return null;
      const label = MARKET_LABEL[bestMarket as SentimentMarket] ?? bestMarket;
      return { market: bestMarket, market_label: label, choice: bestChoice, bet_amount: bestBet };
    }

    // 6) TOP5 배열 조립
    const top5: LeaderboardTop5Item[] = statsRows.map((row, index) => {
      const u = userMap.get(row.user_id);
      const win_rate =
        (row.season_total_count ?? 0) > 0
          ? (row.season_win_count ?? 0) / (row.season_total_count ?? 1)
          : 0;
      const positions = positionsByUserAndMarket.get(row.user_id) ?? {};
      const primary_position = getPrimaryPosition(row.user_id);
      return {
        rank: index + 1,
        user_id: row.user_id,
        nickname: u?.nickname ?? "알 수 없음",
        mmr: Number(row.mmr ?? 0),
        voting_coin_balance: u?.voting_coin_balance ?? 0,
        win_rate: Math.round(win_rate * 10000) / 100,
        positions,
        primary_position,
      };
    });

    return NextResponse.json({
      success: true,
      data: { section: "all", top5 } satisfies LeaderboardTop5Response,
    });
  } catch (e) {
    console.error("Leaderboard top5 error:", e);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "리더보드를 불러오는데 실패했습니다." } },
      { status: 500 }
    );
  }
}
