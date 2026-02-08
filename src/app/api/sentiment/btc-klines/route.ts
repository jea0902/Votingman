/**
 * GET /api/sentiment/btc-klines
 * Binance 1분봉 OHLC 데이터 프록시 (클라이언트 CORS 회피용)
 */

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=200"
    );
    if (!res.ok) {
      throw new Error(`Binance API ${res.status}`);
    }
    const data = (await res.json()) as unknown[];
    if (!Array.isArray(data)) {
      throw new Error("Invalid response");
    }
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[btc-klines] fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: "차트 데이터를 불러올 수 없습니다.",
        },
      },
      { status: 500 }
    );
  }
}
