/**
 * 15분마다 실행: btc_15m 최근 마감 캔들 수집 + 해당 봉 정산
 * - 15:45 KST부터 15분봉 수집 (KST 00, 15, 30, 45분 마감마다)
 * - 수집 직후 방금 마감된 캔들에 해당하는 폴 정산
 *
 * GET /api/cron/btc-ohlc-15m
 * 인증: (1) Header x-cron-secret 또는 Bearer (2) 쿼리 ?cron_secret=<CRON_SECRET>
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

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    let rows = await fetchKlinesKstAligned("btc_15m", 1);
    const { inserted, errors } = await upsertBtcOhlcBatch(rows);

    let settle = null;
    if (rows.length > 0) {
      const justClosed = rows[0];
      const candleStartAtIso = toCanonicalCandleStartAt(justClosed.candle_start_at);
      settle = await settlePoll("", "btc_15m", candleStartAtIso);
      if (
        settle.status === "settled" ||
        settle.status === "invalid_refund"
      ) {
        try {
          await refreshMarketStats(TIER_MARKET_ALL);
        } catch (refreshErr) {
          console.error("[cron/btc-ohlc-15m] refreshMarketStats 실패 (정산은 완료됨):", refreshErr);
        }
      }
    } else {
      // Binance 빈 응답 시에도 기대 candle_start_at으로 정산 시도 (btc_1d와 동일 폴백)
      const fallbackStartAts = getRecentCandleStartAts("btc_15m", 1);
      if (fallbackStartAts[0]) {
        settle = await settlePoll("", "btc_15m", toCanonicalCandleStartAt(fallbackStartAts[0]));
        if (
          settle.status === "settled" ||
          settle.status === "invalid_refund"
        ) {
          try {
            await refreshMarketStats(TIER_MARKET_ALL);
          } catch (refreshErr) {
            console.error("[cron/btc-ohlc-15m] refreshMarketStats 실패 (정산은 완료됨):", refreshErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: rows.length > 0 ? "btc_15m 수집 및 정산 완료" : "btc_15m 캔들 미수집(Binance 빈 응답), 정산만 시도 완료",
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
    console.error("[cron/btc-ohlc-15m] error:", code, e);
    const context: Record<string, unknown> = { market: "btc_15m" };
    try {
      const startAts = getRecentCandleStartAts("btc_15m", 1);
      if (startAts[0]) context.candle_start_at = startAts[0];
    } catch (_) { }
    try {
      await recordCronError("btc-ohlc-15m", code, message, context);
    } catch (_) { }
    return NextResponse.json(
      { success: false, error: { code, message, context } },
      { status: 500 }
    );
  }
}
