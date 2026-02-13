/**
 * POST /api/sentiment/vote
 * 인간 지표 투표 (롱/숏 + 보팅코인 N개). 로그인 필수, 시장별 마감 KST 검증.
 * body: { market?, choice, bet_amount }. market 미지정 시 btc.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateTodayPollByMarket } from "@/lib/sentiment/poll-server";
import { isVotingOpenKST, getVotingCloseLabel } from "@/lib/utils/sentiment-vote";
import { isSentimentMarket } from "@/lib/constants/sentiment-markets";

const MIN_BET = 10;

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
            message: "로그인한 사용자만 투표할 수 있습니다.",
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json();
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

    const choice = body?.choice as string | undefined;
    const betAmountRaw = body?.bet_amount;

    if (choice !== "long" && choice !== "short") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "choice는 'long' 또는 'short'이어야 합니다.",
          },
        },
        { status: 400 }
      );
    }

    const betAmount = Number(betAmountRaw);
    if (!Number.isFinite(betAmount) || betAmount < MIN_BET) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `배팅 코인은 최소 ${MIN_BET}코인 이상이어야 합니다.`,
          },
        },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const { poll } = await getOrCreateTodayPollByMarket(market);

    const { data: userRow } = await admin
      .from("users")
      .select("voting_coin_balance")
      .eq("user_id", user_id)
      .single();

    const balance = Number(userRow?.voting_coin_balance ?? 0);

    const { data: existingVote } = await admin
      .from("sentiment_votes")
      .select("id, choice, bet_amount")
      .eq("poll_id", poll.id)
      .eq("user_id", user_id)
      .maybeSingle();

    const oldBet = Number(existingVote?.bet_amount ?? 0);
    const prevChoice = existingVote?.choice as "long" | "short" | undefined;
    const availableBalance = balance + oldBet;

    if (betAmount > availableBalance) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_BALANCE",
            message: `보팅코인 잔액이 부족합니다. (가용: ${availableBalance.toLocaleString()}코인)`,
          },
        },
        { status: 400 }
      );
    }

    const newBalance = availableBalance - betAmount;

    await admin.from("users").update({ voting_coin_balance: newBalance }).eq("user_id", user_id);

    const longCoinDelta =
      (choice === "long" ? betAmount : 0) - (prevChoice === "long" ? oldBet : 0);
    const shortCoinDelta =
      (choice === "short" ? betAmount : 0) - (prevChoice === "short" ? oldBet : 0);
    const longCountDelta = (choice === "long" ? 1 : 0) - (prevChoice === "long" ? 1 : 0);
    const shortCountDelta = (choice === "short" ? 1 : 0) - (prevChoice === "short" ? 1 : 0);

    const voteMarket = poll.market ?? market;
    if (existingVote) {
      await admin
        .from("sentiment_votes")
        .update({ choice, bet_amount: betAmount, market: voteMarket })
        .eq("id", existingVote.id);
    } else {
      await admin.from("sentiment_votes").insert({
        poll_id: poll.id,
        user_id,
        anonymous_id: null,
        choice,
        bet_amount: betAmount,
        market: voteMarket,
      });
    }

    const newLongCoin = Math.max(0, (poll.long_coin_total ?? 0) + longCoinDelta);
    const newShortCoin = Math.max(0, (poll.short_coin_total ?? 0) + shortCoinDelta);
    const newLongCount = Math.max(0, (poll.long_count ?? 0) + longCountDelta);
    const newShortCount = Math.max(0, (poll.short_count ?? 0) + shortCountDelta);

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
        choice,
        bet_amount: betAmount,
        new_balance: newBalance,
        long_coin_total: newLongCoin,
        short_coin_total: newShortCoin,
        long_count: newLongCount,
        short_count: newShortCount,
        total_coin: newLongCoin + newShortCoin,
        updated: !!existingVote,
      },
    });
  } catch (error) {
    console.error("[sentiment/vote] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "투표 처리에 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
