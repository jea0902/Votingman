/**
 * 보팅맨 시장(섹션)별 TOP5 리더보드 + 오늘 포지션·배팅 코인
 * - 8단계 리더보드 실데이터 연동
 * - 쿼리: ?section=btc|us|kr (미지정 시 btc)
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getCurrentSeasonId } from "@/lib/constants/seasons";
import { getOrCreateTodayPollByMarket } from "@/lib/sentiment/poll-server";

const SECTION_PARAMS = ["btc", "us", "kr"] as const;
type SectionParam = (typeof SECTION_PARAMS)[number];

function isSectionParam(v: string): v is SectionParam {
  return SECTION_PARAMS.includes(v as SectionParam);
}

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
  /** 시장(지수)별 오늘 투표: btc | ndq | sp500 | kospi | kosdaq */
  positions: Record<string, LeaderboardPosition>;
};

export type LeaderboardTop5Response = {
  section: SectionParam;
  top5: LeaderboardTop5Item[];
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sectionParam = searchParams.get("section") ?? "btc";
    const section: SectionParam = isSectionParam(sectionParam) ? sectionParam : "btc";

    const admin = createSupabaseAdmin();
    const seasonId = getCurrentSeasonId();

    // 1) 해당 섹션(티어 시장) MMR 기준 TOP5
    const { data: statsRows, error: statsError } = await admin
      .from("user_season_stats")
      .select("user_id, mmr, season_win_count, season_total_count")
      .eq("market", section)
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
        data: { section, top5: [] } satisfies LeaderboardTop5Response,
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

    // 3) 해당 섹션의 오늘 폴 ID 목록 (sentiment 시장별)
    const markets = section === "btc" ? ["btc"] : section === "us" ? ["ndq", "sp500"] : ["kospi", "kosdaq"];

    const pollIdsByMarket: Record<string, string> = {};
    for (const m of markets) {
      const { poll } = await getOrCreateTodayPollByMarket(m);
      pollIdsByMarket[m] = poll.id;
    }
    const pollIds = Object.values(pollIdsByMarket);

    // 4) TOP5 유저들의 오늘 투표 (poll_id, user_id, choice, bet_amount)
    const { data: votesRows, error: votesError } = await admin
      .from("sentiment_votes")
      .select("poll_id, user_id, choice, bet_amount")
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

    // poll_id → market 매핑
    const { data: pollsRows } = await admin
      .from("sentiment_polls")
      .select("id, market")
      .in("id", pollIds);
    const marketByPollId = new Map((pollsRows ?? []).map((p) => [p.id, p.market ?? ""]));

    const positionsByUserAndMarket = new Map<string, Record<string, LeaderboardPosition>>();
    for (const v of votesRows ?? []) {
      if (!v.user_id) continue;
      const market = marketByPollId.get(v.poll_id) ?? "";
      const key = v.user_id;
      let map = positionsByUserAndMarket.get(key);
      if (!map) {
        map = {};
        positionsByUserAndMarket.set(key, map);
      }
      map[market] = {
        choice: v.choice as "long" | "short",
        bet_amount: Number(v.bet_amount ?? 0),
      };
    }

    // 5) TOP5 배열 조립 (순위 유지)
    const top5: LeaderboardTop5Item[] = statsRows.map((row, index) => {
      const u = userMap.get(row.user_id);
      const win_rate =
        (row.season_total_count ?? 0) > 0
          ? (row.season_win_count ?? 0) / (row.season_total_count ?? 1)
          : 0;
      const positions = positionsByUserAndMarket.get(row.user_id) ?? {};
      return {
        rank: index + 1,
        user_id: row.user_id,
        nickname: u?.nickname ?? "알 수 없음",
        mmr: Number(row.mmr ?? 0),
        voting_coin_balance: u?.voting_coin_balance ?? 0,
        win_rate: Math.round(win_rate * 10000) / 100,
        positions,
      };
    });

    return NextResponse.json({
      success: true,
      data: { section, top5 } satisfies LeaderboardTop5Response,
    });
  } catch (e) {
    console.error("Leaderboard top5 error:", e);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "리더보드를 불러오는데 실패했습니다." } },
      { status: 500 }
    );
  }
}
