/**
 * GET /api/sentiment/btc-klines
 * Binance OHLC 데이터 프록시 (클라이언트 CORS 회피용)
 * 쿼리: interval=1m | 15m | 1h | 4h | 1d (기본 1d)
 */

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_INTERVALS = ["1m", "15m", "1h", "4h", "1d"] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const intervalParam = searchParams.get("interval") ?? "1d";
    const interval = ALLOWED_INTERVALS.includes(intervalParam as (typeof ALLOWED_INTERVALS)[number])
      ? intervalParam
      : "1d";
    const limit = Math.min(1000, Math.max(50, parseInt(searchParams.get("limit") ?? "200", 10) || 200));
    const endTimeParam = searchParams.get("endTime");
    const endTime = endTimeParam ? parseInt(endTimeParam, 10) : undefined;

    const baseUrl = process.env.BINANCE_API_BASE_URL || "https://data-api.binance.vision";
    const url = new URL(`${baseUrl}/api/v3/klines`);
    url.searchParams.set("symbol", "BTCUSDT");
    url.searchParams.set("interval", interval);
    url.searchParams.set("limit", String(limit));
    if (endTime != null && Number.isFinite(endTime)) {
      url.searchParams.set("endTime", String(endTime));
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Binance API ${res.status}: ${text}`);
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
