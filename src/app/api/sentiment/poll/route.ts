/**
 * GET /api/sentiment/poll
 * 오늘(KST) 인간 지표 투표 정보 조회 (poll_id, 시가/종가, 롱/숏 수·코인 집계)
 * - 쿼리: ?market=btc | ndq | sp500 | kospi | kosdaq (미지정 시 btc)
 * - 로그인 시 my_vote(choice, bet_amount) 포함
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOrCreateTodayPollByMarket,
  getOrCreatePollByMarketAndCandleStartAt,
} from "@/lib/sentiment/poll-server";
import {
  getPreviousCandleStartAt,
  CANDLE_PERIOD_MS,
  getBtc1dCandleStartAtUtc,
  normalizeBtc4hCandleStartAt,
  toCanonicalCandleStartAt,
} from "@/lib/btc-ohlc/candle-utils";
import { getOhlcByMarketAndCandleStart } from "@/lib/btc-ohlc/repository";
import { fetchPreviousCandleClose } from "@/lib/binance/btc-klines";
import { isSentimentMarket } from "@/lib/constants/sentiment-markets";

const BTC_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketParam = searchParams.get("market") ?? "btc_1d";
    const market = isSentimentMarket(marketParam) ? marketParam : "btc_1d";
    const candleStartAtParam = searchParams.get("candle_start_at");

    const { poll } =
      candleStartAtParam && BTC_MARKETS.includes(market as (typeof BTC_MARKETS)[number])
        ? await getOrCreatePollByMarketAndCandleStartAt(
            market as (typeof BTC_MARKETS)[number],
            candleStartAtParam
          )
        : await getOrCreateTodayPollByMarket(market);

    let price_open: number | null = null;
    let price_close: number | null = null;
    const candleStartAt =
      "candle_start_at" in poll && typeof poll.candle_start_at === "string"
        ? poll.candle_start_at
        : null;
    if (
      candleStartAt &&
      BTC_MARKETS.includes(market as (typeof BTC_MARKETS)[number])
    ) {
      // 목표가 = 이전 봉 종가 (새 봉의 시가). btc_1d/btc_4h는 UTC 기준으로만 조회 (Binance와 동일).
      const base = toCanonicalCandleStartAt(candleStartAt);
      const ohlcKey =
        market === "btc_1d"
          ? getBtc1dCandleStartAtUtc(base.slice(0, 10))
          : market === "btc_4h"
            ? normalizeBtc4hCandleStartAt(base)
            : base;
      const previousCandleStartAt = getPreviousCandleStartAt(market, ohlcKey);
      // btc_4h: 차트가 Binance API를 쓰므로 목표가도 Binance에서 직접 조회해 직전 4h 봉 종가와 정확히 일치시키기
      if (market === "btc_4h") {
        try {
          price_open = await fetchPreviousCandleClose(market, ohlcKey);
        } catch (e) {
          console.error("[sentiment/poll] fetchPreviousCandleClose(btc_4h) error:", e);
        }
        if (price_open == null) {
          const prevOhlc = await getOhlcByMarketAndCandleStart(market, previousCandleStartAt);
          if (prevOhlc) price_open = prevOhlc.close;
        }
      } else {
        const prevOhlc = await getOhlcByMarketAndCandleStart(market, previousCandleStartAt);
        if (prevOhlc) {
          price_open = prevOhlc.close;
        } else {
          try {
            price_open = await fetchPreviousCandleClose(market, ohlcKey);
            if (price_open == null) {
              console.warn(
                "[sentiment/poll] price_open missing: 이전 봉 종가 조회 실패",
                { market, candle_start_at: candleStartAt, ohlcKey }
              );
            }
          } catch (e) {
            console.error("[sentiment/poll] fetchPreviousCandleClose error:", e);
          }
        }
      }
      // 종가 = btc_ohlc에만 의존. cron이 수집·저장한 뒤에만 존재. Binance 직접 조회 금지.
      const currentOhlc = await getOhlcByMarketAndCandleStart(market, ohlcKey);
      if (currentOhlc) {
        price_close = currentOhlc.close;
      }
    }

    let myVote: { choice: "long" | "short"; bet_amount: number } | null = null;
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();
    const admin = createSupabaseAdmin();
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

    // sentiment_votes 기준으로 롱/숏 인원 수 계산 (무효 후 재투표 등으로 sentiment_polls 집계와 불일치 시 실제 데이터 우선)
    const { data: voteCounts } = await admin
      .from("sentiment_votes")
      .select("choice")
      .eq("poll_id", poll.id)
      .gt("bet_amount", 0);
    const longCount = (voteCounts ?? []).filter((v) => v.choice === "long").length;
    const shortCount = (voteCounts ?? []).filter((v) => v.choice === "short").length;

    // 정산 상태: btc_ohlc(DB) + 마감 시각 검증. cron은 KST 09:00(=UTC 00:00)에만 수집.
    let settlement_status: "open" | "closed" | "settling" | "settled" = "open";
    const pollRow = poll as { settled_at?: string | null };

    if (pollRow.settled_at) {
      settlement_status = "settled";
    } else if (price_close != null && candleStartAt) {
      // btc_ohlc에 종가 있음 + 마감 시각(candle_start_at+period) 경과 확인
      // KST 09:00 전에 잘못 마감 표시 방지 (cron은 09:00에만 실행)
      const periodMs = CANDLE_PERIOD_MS[market];
      const closeUtcMs = new Date(candleStartAt).getTime() + (periodMs ?? 0);
      if (periodMs && Date.now() >= closeUtcMs) {
        const { count } = await admin
          .from("payout_history")
          .select("*", { count: "exact", head: true })
          .eq("poll_id", poll.id);
        settlement_status = count && count > 0 ? "settled" : "settling";
      }
      // closeUtcMs 전이면 "open" 유지 (cron이 09:00에 안 돌았는데 DB에 있으면 무시)
    }

    return NextResponse.json({
      success: true,
      data: {
        market: poll.market ?? market,
        poll_id: poll.id,
        poll_date: poll.poll_date,
        candle_start_at: candleStartAt ?? undefined,
        price_open,
        price_close,
        settlement_status,
        long_count: longCount,
        short_count: shortCount,
        total_count: longCount + shortCount,
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
