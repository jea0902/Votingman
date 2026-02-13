/**
 * POST /api/sentiment/vote/cancel
 * 오늘 해당 시장 폴에 대한 본인 배팅 취소. body: { market? } (미지정 시 btc).
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateTodayPollByMarket } from "@/lib/sentiment/poll-server";
import { isVotingOpenKST, getVotingCloseLabel } from "@/lib/utils/sentiment-vote";
import { isSentimentMarket } from "@/lib/constants/sentiment-markets";

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const marketParam = body?.market ?? "btc_1d";
    const market = isSentimentMarket(marketParam) ? marketParam : "btc_1d";

    if (!isVotingOpenKST(market)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VOTING_CLOSED",
            message: `해당 시장 투표 마감 시간(${getVotingCloseLabel(market)})이 지났습니다.`,
          },
        },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const { poll } = await getOrCreateTodayPollByMarket(market);

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
    const newBalance = currentBalance + refundAmount;
    await admin
      .from("users")
      .update({ voting_coin_balance: newBalance })
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
        market: poll.market ?? market,
        cancelled: true,
        refund_amount: refundAmount,
        new_balance: newBalance,
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
