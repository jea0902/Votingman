/**
 * 4시간마다 실행: btc_4h 최근 마감 캔들 수집 + 해당 봉 정산
 * - UTC 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 (Binance 4h와 동일)
 * - cron-job.org 스케줄: 00:05, 04:05, 08:05, 12:05, 16:05, 20:05 UTC
 *
 * GET /api/cron/btc-ohlc-4h
 * 인증: (1) Header x-cron-secret 또는 Authorization: Bearer <CRON_SECRET>
 *       (2) 쿼리 ?cron_secret=<CRON_SECRET> (헤더 설정이 어려운 크론 서비스용)
 */

import { NextResponse } from "next/server";
import { getRecentCandleStartAts } from "@/lib/btc-ohlc/candle-utils";
import { fetchKlinesKstAligned } from "@/lib/binance/btc-klines";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";
import { settlePoll } from "@/lib/sentiment/settlement-service";
import { refreshMarketStats } from "@/lib/tier/tier-service";
import { TIER_MARKET_ALL } from "@/lib/tier/constants";
import { recordCronError } from "@/lib/monitor/cron-error-log";
import { getCronSecret, isCronAuthorized } from "@/lib/cron/auth";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    const body: { success: false; error: string; debug?: string } = {
      success: false,
      error: "Unauthorized",
    };
    if (process.env.NODE_ENV === "development" && !getCronSecret()) {
      body.debug = "CRON_SECRET (or CRON-SECRET) not set in env.";
    }
    return NextResponse.json(body, { status: 401 });
  }

  try {
    const rows = await fetchKlinesKstAligned("btc_4h", 1);
    const { inserted, errors } = await upsertBtcOhlcBatch(rows);

    let settle = null;
    if (rows.length > 0) {
      const justClosed = rows[0];
      // DB 비교 시 포맷 통일 (ISO 정규화)
      const candleStartAtIso = new Date(justClosed.candle_start_at).toISOString();
      settle = await settlePoll("", "btc_4h", candleStartAtIso);
      if (settle.status === "already_settled" && settle.error?.includes("폴을 찾을 수 없습니다")) {
        console.warn("[cron/btc-ohlc-4h] 정산 대상 폴 없음", {
          candle_start_at: candleStartAtIso,
          hint: "sentiment_polls에 (market=btc_4h, candle_start_at) 일치하는 폴이 있는지 확인. 미정산 폴은 POST /api/admin/backfill-and-settle 에 pollIds 로 요청.",
        });
      }
      if (
        settle.status === "settled" ||
        settle.status === "invalid_refund"
      ) {
        try {
          await refreshMarketStats(TIER_MARKET_ALL);
        } catch (refreshErr) {
          console.error("[cron/btc-ohlc-4h] refreshMarketStats 실패 (정산은 완료됨):", refreshErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "btc_4h 수집 및 정산 완료",
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
    console.error("[cron/btc-ohlc-4h] error:", code, e);
    const context: Record<string, unknown> = { market: "btc_4h" };
    try {
      const startAts = getRecentCandleStartAts("btc_4h", 1);
      if (startAts[0]) context.candle_start_at = startAts[0];
    } catch (_) {}
    try {
      await recordCronError("btc-ohlc-4h", code, message, context);
    } catch (_) {
      // 로그 저장 실패해도 원래 500 응답 유지
    }
    return NextResponse.json(
      {
        success: false,
        error: { code, message, context },
      },
      { status: 500 }
    );
  }
}
