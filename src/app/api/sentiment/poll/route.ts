/**
 * GET /api/sentiment/poll
 * 오늘(KST) 인간 지표 투표 정보 조회 (poll_id, 시가/종가, 롱/숏 수·코인 집계)
 * - 쿼리: ?market=btc | ndq | sp500 | kospi | kosdaq (미지정 시 btc)
 * - 로그인 시 my_vote(choice, bet_amount) 포함
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateTodayPollByMarket } from "@/lib/sentiment/poll-server";
import { getPreviousCandleStartAt } from "@/lib/btc-ohlc/candle-utils";
import { getOhlcByMarketAndCandleStart } from "@/lib/btc-ohlc/repository";
import { fetchPreviousCandleClose } from "@/lib/binance/btc-klines";
import { isSentimentMarket } from "@/lib/constants/sentiment-markets";

const BTC_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketParam = searchParams.get("market") ?? "btc_1d";
    const market = isSentimentMarket(marketParam) ? marketParam : "btc_1d";

    const { poll } = await getOrCreateTodayPollByMarket(market);

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
      // 목표가 = 이전 봉 종가 (UP/DOWN 투표 기준). 이전 봉은 마감되어 DB·Binance 모두 존재함.
      const previousCandleStartAt = getPreviousCandleStartAt(market, candleStartAt);
      const prevOhlc = await getOhlcByMarketAndCandleStart(market, previousCandleStartAt);
      if (prevOhlc) {
        price_open = prevOhlc.close;
      } else {
        try {
          price_open = await fetchPreviousCandleClose(market, candleStartAt);
          if (price_open == null) {
            console.warn(
              "[sentiment/poll] price_open missing: 이전 봉 종가 조회 실패",
              { market, candle_start_at: candleStartAt }
            );
          }
        } catch (e) {
          console.error("[sentiment/poll] fetchPreviousCandleClose error:", e);
        }
      }
      // 종가 = 현재 봉 종가 (봉 마감 후 크론이 넣은 뒤에만 존재)
      const currentOhlc = await getOhlcByMarketAndCandleStart(market, candleStartAt);
      if (currentOhlc) price_close = currentOhlc.close;
    }

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
        market: poll.market ?? market,
        poll_id: poll.id,
        poll_date: poll.poll_date,
        price_open,
        price_close,
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
