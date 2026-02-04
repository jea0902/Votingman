/**
 * GET /api/sentiment/poll
 * 오늘(KST) 인간 지표 투표 정보 조회 (poll_id, 시가/종가, 롱/숏 수·코인 집계)
 * - 로그인 시 my_vote(choice, bet_amount) 포함
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateTodayPoll } from "@/lib/sentiment/poll-server";

export async function GET() {
  try {
    const { poll } = await getOrCreateTodayPoll();

    let myVote: { choice: "long" | "short"; bet_amount: number } | null = null;
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();
    if (user?.id) {
      const admin = createSupabaseAdmin();
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

    return NextResponse.json({
      success: true,
      data: {
        poll_id: poll.id,
        poll_date: poll.poll_date,
        btc_open: poll.btc_open,
        btc_close: poll.btc_close,
        long_count: poll.long_count,
        short_count: poll.short_count,
        total_count: (poll.long_count ?? 0) + (poll.short_count ?? 0),
        long_coin_total: poll.long_coin_total ?? 0,
        short_coin_total: poll.short_coin_total ?? 0,
        total_coin: (poll.long_coin_total ?? 0) + (poll.short_coin_total ?? 0),
        my_vote: myVote,
      },
    });
  } catch (error) {
    console.error("[sentiment/poll] GET error:", error);
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
