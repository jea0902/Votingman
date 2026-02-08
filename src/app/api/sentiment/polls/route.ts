/**
 * GET /api/sentiment/polls
 * 오늘(KST) 전체 시장(btc, ndq, sp500, kospi, kosdaq) 폴 정보 한 번에 조회
 * - UI 3섹션에서 5개 시장 폴을 한 번에 불러올 때 사용
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateTodayPollByMarket } from "@/lib/sentiment/poll-server";
import { SENTIMENT_MARKETS } from "@/lib/constants/sentiment-markets";

export async function GET() {
  try {
    const pollsByMarket: Record<
      string,
      {
        market: string;
        poll_id: string;
        poll_date: string;
        price_open: number | null;
        price_close: number | null;
        long_count: number;
        short_count: number;
        total_count: number;
        participant_count: number;
        long_coin_total: number;
        short_coin_total: number;
        total_coin: number;
        my_vote: { choice: "long" | "short"; bet_amount: number } | null;
      }
    > = {};

    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();
    const admin = createSupabaseAdmin();

    for (const market of SENTIMENT_MARKETS) {
      const { poll } = await getOrCreateTodayPollByMarket(market);

      let myVote: { choice: "long" | "short"; bet_amount: number } | null = null;
      if (user?.id) {
        const { data: vote } = await admin
          .from("sentiment_votes")
          .select("choice, bet_amount")
          .eq("poll_id", poll.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (vote && Number(vote.bet_amount) > 0) {
          myVote = {
            choice: vote.choice as "long" | "short",
            bet_amount: Number(vote.bet_amount),
          };
        }
      }

      /** sentiment_votes 기준 실제 참여자 수 (bet_amount > 0) */
      const { count: participantCount } = await admin
        .from("sentiment_votes")
        .select("id", { count: "exact", head: true })
        .eq("poll_id", poll.id)
        .gt("bet_amount", 0);

      pollsByMarket[market] = {
        market: poll.market ?? market,
        poll_id: poll.id,
        poll_date: poll.poll_date,
        price_open: poll.price_open,
        price_close: poll.price_close,
        long_count: poll.long_count ?? 0,
        short_count: poll.short_count ?? 0,
        total_count: (poll.long_count ?? 0) + (poll.short_count ?? 0),
        participant_count: participantCount ?? 0,
        long_coin_total: poll.long_coin_total ?? 0,
        short_coin_total: poll.short_coin_total ?? 0,
        total_coin: (poll.long_coin_total ?? 0) + (poll.short_coin_total ?? 0),
        my_vote: myVote,
      };
    }

    return NextResponse.json({
      success: true,
      data: pollsByMarket,
    });
  } catch (error) {
    console.error("[sentiment/polls] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "투표 정보를 불러오는데 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
