/**
 * 5분마다 실행: btc_5m 최근 마감 캔들 수집 + 해당 봉 정산
 * - KST 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55분 마감마다
 * - 수집 직후 방금 마감된 캔들에 해당하는 폴 정산
 *
 * GET /api/cron/btc-ohlc-5m
 * 인증: (1) Header x-cron-secret 또는 Bearer (2) 쿼리 ?cron_secret=<CRON_SECRET>
 * cron-job.org: 5분마다 실행 (예: 00:05, 00:10, 00:15, ...)
 */

import { NextResponse } from "next/server";
import { fetchKlinesKstAligned } from "@/lib/binance/btc-klines";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";
import { settlePoll } from "@/lib/sentiment/settlement-service";
import { refreshMarketStats } from "@/lib/tier/tier-service";
import { TIER_MARKET_ALL } from "@/lib/tier/constants";
import { isCronAuthorized } from "@/lib/cron/auth";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const rows = await fetchKlinesKstAligned("btc_5m", 1);
    const { inserted, errors } = await upsertBtcOhlcBatch(rows);

    let settle = null;
    if (rows.length > 0) {
      const justClosed = rows[0];
      settle = await settlePoll("", "btc_5m", justClosed.candle_start_at);
      if (
        settle.status === "settled" ||
        settle.status === "invalid_refund"
      ) {
        await refreshMarketStats(TIER_MARKET_ALL);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "btc_5m 수집 및 정산 완료",
        total_fetched: rows.length,
        upserted: inserted,
        errors,
        settle,
      },
    });
  } catch (e) {
    console.error("[cron/btc-ohlc-5m] error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
