/**
 * 비트코인 OHLC 수집 후 btc_ohlc에 반영
 * - Binance에서 조회 후 btc_ohlc upsert (종가끼리 비교 정산용)
 *
 * POST /api/sentiment/poll/ohlc
 * body: { poll_date: "YYYY-MM-DD", market?: "btc_1d" }
 */

import { NextResponse } from "next/server";
import { fetchOhlcForPollDate } from "@/lib/binance/btc-klines";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pollDate = body?.poll_date;
    const market = body?.market ?? "btc_1d";

    if (!pollDate || !POLL_DATE_REGEX.test(pollDate)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "poll_date는 YYYY-MM-DD 형식이어야 합니다.",
          },
        },
        { status: 400 }
      );
    }

    const btcMarkets = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"];
    if (!btcMarkets.includes(market)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "btc_1d, btc_4h, btc_1h, btc_15m 시장만 지원합니다.",
          },
        },
        { status: 400 }
      );
    }

    const rows = await fetchOhlcForPollDate(market, pollDate);
    const { inserted } = await upsertBtcOhlcBatch(rows);

    const first = rows[0];
    const price_open = first?.open ?? null;
    const price_close = first?.close ?? null;

    return NextResponse.json({
      success: true,
      data: {
        poll_date: pollDate,
        market,
        price_open,
        price_close,
        upserted: inserted,
      },
    });
  } catch (e) {
    console.error("[sentiment/poll/ohlc] error:", e);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "시가·종가 반영 중 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
