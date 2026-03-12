/**
 * POST /api/sentiment/vote
 * 인간 지표 투표 (롱/숏 + 보팅코인 N개). 로그인 필수, 시장별 마감 KST 검증.
 * body: { market?, poll_id?, choice, bet_amount }. poll_id 있으면 해당 폴에 투표, 없으면 현재 폴.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateTodayPollByMarket } from "@/lib/sentiment/poll-server";
import {
  isVotingOpenKST,
  getVotingCloseLabel,
  getLateVotingMultiplier,
} from "@/lib/utils/sentiment-vote";
import { isSentimentMarket, MIN_BET_VTC } from "@/lib/constants/sentiment-markets";
import { toCanonicalCandleStartAt } from "@/lib/btc-ohlc/candle-utils";
import { getOhlcByMarketAndCandleStart } from "@/lib/btc-ohlc/repository";
import { CANDLE_PERIOD_MS, VOTING_CLOSE_EARLY_MS } from "@/lib/btc-ohlc/candle-utils";

const COIN_MARKETS = [
  "btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m",
  "eth_1d", "eth_4h", "eth_1h", "eth_15m", "eth_5m",
  "usdt_1d", "usdt_4h", "usdt_1h", "usdt_15m", "usdt_5m",
  "xrp_1d", "xrp_4h", "xrp_1h", "xrp_15m", "xrp_5m",
] as const;

/** 폴의 캔들 마감 시각이 지났는지 (투표 불가). 1초 조기 마감 적용 */
function isPollCandleClosed(
  candleStartAt: string,
  market: string
): boolean {
  const periodMs = CANDLE_PERIOD_MS[market];
  if (!periodMs) return false;
  const closeUtcMs = new Date(candleStartAt).getTime() + periodMs - VOTING_CLOSE_EARLY_MS;
  return Date.now() >= closeUtcMs;
}

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
    const pollIdParam = body?.poll_id as string | undefined;

    const admin = createSupabaseAdmin();
    let poll: { id: string; market?: string; candle_start_at?: string; [k: string]: unknown };

    if (pollIdParam && typeof pollIdParam === "string") {
      const { data: pollRow } = await admin
        .from("sentiment_polls")
        .select("*")
        .eq("id", pollIdParam)
        .maybeSingle();
      if (!pollRow) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "POLL_NOT_FOUND", message: "해당 투표를 찾을 수 없습니다." },
          },
          { status: 404 }
        );
      }
      poll = pollRow as typeof poll;
    } else {
      const result = await getOrCreateTodayPollByMarket(market);
      poll = result.poll as typeof poll;
    }

    const candleStartAt =
      "candle_start_at" in poll && typeof poll.candle_start_at === "string"
        ? poll.candle_start_at
        : null;

    // btc 시장: 1) 캔들 마감 시각 경과 시 즉시 차단 2) btc_ohlc에 종가 있으면 차단
    const pollMarket = poll.market ?? market;
    if (
      candleStartAt &&
      COIN_MARKETS.includes(pollMarket as (typeof COIN_MARKETS)[number])
    ) {
      if (isPollCandleClosed(candleStartAt, pollMarket)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VOTING_CLOSED",
              message: "해당 투표는 마감되었습니다. (마감 시각 경과)",
            },
          },
          { status: 400 }
        );
      }
      const ohlc = await getOhlcByMarketAndCandleStart(
        pollMarket,
        toCanonicalCandleStartAt(candleStartAt)
      );
      if (ohlc) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VOTING_CLOSED",
              message: "해당 투표는 마감되었습니다. (cron 수집 완료)",
            },
          },
          { status: 400 }
        );
      }
    } else if (!isVotingOpenKST(market)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VOTING_CLOSED",
            message: `해당 시장 투표 마감 시간이 지났습니다.\n(${getVotingCloseLabel(market)})`,
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
    const multiplier = getLateVotingMultiplier(market);
    const minCharge = Math.ceil(MIN_BET_VTC * multiplier);
    if (!Number.isFinite(betAmount) || betAmount < minCharge) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `현재 투표권 ${multiplier}배 적용. 최소 ${minCharge} VTC 이상이어야 합니다.`,
          },
        },
        { status: 400 }
      );
    }

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
    if (existingVote && oldBet > 0) {
      const sameChoice = choice === (existingVote.choice as string);
      const isIncrease = betAmount > oldBet;
      if (!sameChoice || !isIncrease) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VOTE_FINAL",
              message:
                "확정된 투표는 선택을 바꾸거나 줄일 수 없습니다. 같은 선택에 한해 추가 배팅만 가능합니다.",
            },
          },
          { status: 400 }
        );
      }
    }
    // oldBet=0이면 무효 처리 후 재투표 등으로 이전 투표가 없는 것과 동일 → prevChoice 무시
    const prevChoice =
      existingVote && oldBet > 0
        ? (existingVote.choice as "long" | "short")
        : undefined;
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

    const newLongCoin = Math.max(0, Number(poll.long_coin_total ?? 0) + longCoinDelta);
    const newShortCoin = Math.max(0, Number(poll.short_coin_total ?? 0) + shortCoinDelta);
    const newLongCount = Math.max(0, Number(poll.long_count ?? 0) + longCountDelta);
    const newShortCount = Math.max(0, Number(poll.short_count ?? 0) + shortCountDelta);

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
