/**
 * 매시 5분에 실행: btc_1h 최근 마감 캔들 수집
 *
 * GET /api/cron/btc-ohlc-1h
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret
 */

import { NextResponse } from "next/server";
import { fetchKlinesKstAligned } from "@/lib/binance/btc-klines";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";

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
    const rows = await fetchKlinesKstAligned("btc_1h", 3);
    const { inserted, errors } = await upsertBtcOhlcBatch(rows);

    return NextResponse.json({
      success: true,
      data: {
        message: "btc_1h 수집 완료",
        total_fetched: rows.length,
        upserted: inserted,
        errors,
      },
    });
  } catch (e) {
    console.error("[cron/btc-ohlc-1h] error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
