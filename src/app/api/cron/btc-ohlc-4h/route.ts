/**
 * 4시간마다 실행: btc_4h 최근 마감 캔들 수집 + 해당 봉 정산
 * - KST 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 시 정각 마감 (크론 실행 시각과 동일)
 * - 1h 캔들 4개 집계로 OHLC 생성 (Binance 4h는 UTC 정렬이라 사용 안 함)
 *
 * GET /api/cron/btc-ohlc-4h
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret
 */

import { NextResponse } from "next/server";
import { fetchKlinesKstAligned } from "@/lib/binance/btc-klines";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";
import { settlePoll } from "@/lib/sentiment/settlement-service";
import { refreshMarketStats } from "@/lib/tier/tier-service";
import { TIER_MARKET_ALL } from "@/lib/tier/constants";
import { recordCronError } from "@/lib/monitor/cron-error-log";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7) === secret;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  return headerSecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const rows = await fetchKlinesKstAligned("btc_4h", 1);
    const { inserted, errors } = await upsertBtcOhlcBatch(rows);

    let settle = null;
    if (rows.length > 0) {
      const justClosed = rows[0];
      settle = await settlePoll("", "btc_4h", justClosed.candle_start_at);
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
    try {
      await recordCronError("btc-ohlc-4h", code, message);
    } catch (_) {
      // 로그 저장 실패해도 원래 500 응답 유지
    }
    return NextResponse.json(
      {
        success: false,
        error: { code, message },
      },
      { status: 500 }
    );
  }
}
