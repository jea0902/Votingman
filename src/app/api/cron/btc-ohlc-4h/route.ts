/**
 * 4시간마다 실행: btc_4h 최근 마감 캔들 수집 + 해당 봉 정산
 * - Binance 4h: UTC 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 시작
 * - 마감 시각(KST): 09:00, 13:00, 17:00, 21:00, 01:00, 05:00 (UTC+9)
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
    console.error("[cron/btc-ohlc-4h] error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
