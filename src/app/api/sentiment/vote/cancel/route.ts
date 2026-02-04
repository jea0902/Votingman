/**
 * POST /api/sentiment/vote/cancel
 * 오늘 폴에 대한 본인 배팅 취소. 잔액 반환, bet_amount=0 처리, 폴 코인/인원 집계에서 제외.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateTodayPoll } from "@/lib/sentiment/poll-server";
import { isVotingOpenKST } from "@/lib/utils/sentiment-vote";

export async function POST() {
  try {
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();
    const user_id = user?.id ?? null;

    if (!user_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "로그인한 사용자만 취소할 수 있습니다.",
          },
        },
        { status: 401 }
      );
    }

    if (!isVotingOpenKST()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VOTING_CLOSED",
            message: "오늘 투표 마감 시간(20:30 KST)이 지났습니다.",
          },
        },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const { poll } = await getOrCreateTodayPoll();

    const { data: existingVote } = await admin
      .from("sentiment_votes")
      .select("id, choice, bet_amount")
      .eq("poll_id", poll.id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (!existingVote) {
      return NextResponse.json({
        success: true,
        data: {
          cancelled: false,
          message: "취소할 배팅이 없습니다.",
          long_coin_total: poll.long_coin_total ?? 0,
          short_coin_total: poll.short_coin_total ?? 0,
          long_count: poll.long_count ?? 0,
          short_count: poll.short_count ?? 0,
        },
      });
    }

    const refundAmount = Number(existingVote.bet_amount ?? 0);
    if (refundAmount <= 0) {
      return NextResponse.json({
        success: true,
        data: {
          cancelled: false,
          message: "이미 취소된 상태입니다.",
          long_coin_total: poll.long_coin_total ?? 0,
          short_coin_total: poll.short_coin_total ?? 0,
          long_count: poll.long_count ?? 0,
          short_count: poll.short_count ?? 0,
        },
      });
    }

    const prevChoice = existingVote.choice as "long" | "short";

    const { data: userRow } = await admin
      .from("users")
      .select("voting_coin_balance")
      .eq("user_id", user_id)
      .single();
    const currentBalance = Number(userRow?.voting_coin_balance ?? 0);
    await admin
      .from("users")
      .update({ voting_coin_balance: currentBalance + refundAmount })
      .eq("user_id", user_id);

    await admin
      .from("sentiment_votes")
      .update({ bet_amount: 0 })
      .eq("id", existingVote.id);

    const newLongCoin = Math.max(
      0,
      (poll.long_coin_total ?? 0) - (prevChoice === "long" ? refundAmount : 0)
    );
    const newShortCoin = Math.max(
      0,
      (poll.short_coin_total ?? 0) - (prevChoice === "short" ? refundAmount : 0)
    );
    const newLongCount = Math.max(
      0,
      (poll.long_count ?? 0) - (prevChoice === "long" ? 1 : 0)
    );
    const newShortCount = Math.max(
      0,
      (poll.short_count ?? 0) - (prevChoice === "short" ? 1 : 0)
    );

    await admin
      .from("sentiment_polls")
      .update({
        long_coin_total: newLongCoin,
        short_coin_total: newShortCoin,
        long_count: newLongCount,
        short_count: newShortCount,
      })
      .eq("id", poll.id);

    return NextResponse.json({
      success: true,
      data: {
        cancelled: true,
        refund_amount: refundAmount,
        long_coin_total: newLongCoin,
        short_coin_total: newShortCoin,
        long_count: newLongCount,
        short_count: newShortCount,
        total_coin: newLongCoin + newShortCoin,
      },
    });
  } catch (error) {
    console.error("[sentiment/vote/cancel] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "취소 처리에 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
