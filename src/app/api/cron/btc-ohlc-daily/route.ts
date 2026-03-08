/**
 * 매일 KST 09:00에 실행: btc_1d 최근 마감 캔들 수집 + 해당 봉 정산
 *
 * 4h/1h/15m과 동일한 로직: fetchKlinesKstAligned → upsertBtcOhlcBatch → settlePoll
 * 수집 시간만 다름 (1d: 매일 09:00 KST = UTC 00:00 마감 직후)
 *
 * 1W, 1M, 12M: 미사용 (수집·정산 없음)
 *
 * cron-job.org: 매일 09:00 KST
 * 인증: (1) Header x-cron-secret 또는 Authorization: Bearer <CRON_SECRET>
 *       (2) 쿼리 ?cron_secret=<CRON_SECRET> (헤더 설정이 어려운 크론 서비스용)
 * - getRecentCandleStartAts 경계 회피를 위해 3초 지연 후 수집
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
    let settle = null;
    let rows = await fetchKlinesKstAligned("btc_1d", 1);
    if (rows.length === 0) {
      const fallbackStartAts = getRecentCandleStartAts("btc_1d", 1);
      if (fallbackStartAts[0]) {
        settle = await settlePoll("", "btc_1d", fallbackStartAts[0]);
        if (
          settle.status === "settled" ||
          settle.status === "invalid_refund"
        ) {
          refreshMarketStats(TIER_MARKET_ALL).catch((refreshErr) => {
            console.error("[cron/btc-ohlc-daily] refreshMarketStats 실패:", refreshErr);
          });
        }
        return NextResponse.json({
          success: true,
          data: {
            message: "btc_1d 캔들 미수집(Binance 빈 응답), 정산만 시도 완료",
            total_fetched: 0,
            upserted: 0,
            errors: 0,
            settle,
          },
        });
      }
    }
    const { inserted, errors } = await upsertBtcOhlcBatch(rows);

    if (rows.length > 0) {
      const justClosed = rows[0];
      settle = await settlePoll("", "btc_1d", toCanonicalCandleStartAt(justClosed.candle_start_at));
      if (
        settle.status === "settled" ||
        settle.status === "invalid_refund"
      ) {
        refreshMarketStats(TIER_MARKET_ALL).catch((refreshErr) => {
          console.error("[cron/btc-ohlc-daily] refreshMarketStats 실패 (정산은 완료됨):", refreshErr);
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "btc_1d 수집 및 정산 완료",
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
    console.error("[cron/btc-ohlc-daily] error:", code, e);
    const context: Record<string, unknown> = { market: "btc_1d" };
    try {
      const startAts = getRecentCandleStartAts("btc_1d", 1);
      if (startAts[0]) context.candle_start_at = startAts[0];
    } catch (_) {}
    try {
      await recordCronError("btc-ohlc-daily", code, message, context);
    } catch (_) {}
    return NextResponse.json(
      { success: false, error: { code, message, context } },
      { status: 500 }
    );
  }
}
