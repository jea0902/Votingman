/**
 * 5분마다 실행: btc_5m 최근 마감 캔들 수집 + 해당 봉 정산
 * - KST 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55분 마감마다
 * - 수집 직후 방금 마감된 캔들에 해당하는 폴 정산
 *
 * GET /api/cron/btc-ohlc-5m
 * 인증: (1) Header x-cron-secret 또는 Bearer (2) 쿼리 ?cron_secret=<CRON_SECRET>
 * cron-job.org: 5분마다 실행 (예: 00:00, 00:05, 00:10, ...)
 * - getRecentCandleStartAts 경계(21:50:00 직전→21:40 캔들) 회피를 위해 3초 지연 후 수집
 */

import { NextResponse } from "next/server";
import { getRecentCandleStartAts, toCanonicalCandleStartAt } from "@/lib/btc-ohlc/candle-utils";
import { fetchKlinesKstAligned } from "@/lib/binance/btc-klines";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";
import { settlePoll } from "@/lib/sentiment/settlement-service";
import { refreshMarketStats } from "@/lib/tier/tier-service";
import { TIER_MARKET_ALL } from "@/lib/tier/constants";
import { recordCronError } from "@/lib/monitor/cron-error-log";
import { isCronAuthorized } from "@/lib/cron/auth";

const CRON_START_DELAY_MS = 3000;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  await new Promise((r) => setTimeout(r, CRON_START_DELAY_MS));

  try {
    const rows = await fetchKlinesKstAligned("btc_5m", 1);
    const { inserted, errors } = await upsertBtcOhlcBatch(rows);

    let settle = null;
    if (rows.length > 0) {
      const justClosed = rows[0];
      const candleStartAtIso = toCanonicalCandleStartAt(justClosed.candle_start_at);
      console.error("[cron/btc-ohlc-5m] 정산 시도", {
        candle_start_at: candleStartAtIso,
        candle_start_at_raw: justClosed.candle_start_at,
      });
      settle = await settlePoll("", "btc_5m", candleStartAtIso);
      if (settle.error) {
        (settle as Record<string, unknown>).candle_start_at_searched = candleStartAtIso;
      }
      if (
        settle.status === "settled" ||
        settle.status === "invalid_refund"
      ) {
        refreshMarketStats(TIER_MARKET_ALL).catch((refreshErr) => {
          console.error("[cron/btc-ohlc-5m] refreshMarketStats 실패 (정산은 완료됨):", refreshErr);
        });
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
    const message = e instanceof Error ? e.message : String(e);
    const code =
      message.includes("Binance") || message.includes("klines")
        ? "BINANCE_ERROR"
        : message.includes("btc_ohlc") || message.includes("upsert")
          ? "DB_UPSERT_ERROR"
          : message.includes("환불") || message.includes("정산") || message.includes("users")
            ? "SETTLEMENT_ERROR"
            : "CRON_ERROR";
    console.error("[cron/btc-ohlc-5m] error:", code, e);
    const context: Record<string, unknown> = { market: "btc_5m" };
    try {
      const startAts = getRecentCandleStartAts("btc_5m", 1);
      if (startAts[0]) context.candle_start_at = startAts[0];
    } catch (_) {}
    try {
      await recordCronError("btc-ohlc-5m", code, message, context);
    } catch (_) {}
    return NextResponse.json(
      { success: false, error: { code, message, context } },
      { status: 500 }
    );
  }
}
