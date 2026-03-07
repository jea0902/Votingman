/**
 * GET /api/sentiment/kospi-klines
 * Yahoo Finance KOSPI(^KS11) OHLC 프록시
 * - CORS 회피용 서버 사이드 fetch
 * - interval=1m|5m|15m|1h|1d
 * - 응답: lightweight-charts 호환 [{ time, open, high, low, close }]
 */

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_INTERVALS = ["1m", "5m", "15m", "1h", "1d"] as const;
type KospiInterval = (typeof ALLOWED_INTERVALS)[number];

// Yahoo interval → range (분봉/시간봉은 1d~5d, 일봉은 1mo~2y)
const INTERVAL_RANGE: Record<KospiInterval, string> = {
  "1m": "1d",
  "5m": "5d",
  "15m": "5d",
  "1h": "5d",
  "1d": "1y",
};

type YahooQuote = { open?: number[]; high?: number[]; low?: number[]; close?: number[] };
type YahooResult = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: YahooQuote[] };
    }>;
  };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const intervalParam = searchParams.get("interval") ?? "1d";
    const interval = ALLOWED_INTERVALS.includes(intervalParam as KospiInterval)
      ? (intervalParam as KospiInterval)
      : "1d";
    const range = INTERVAL_RANGE[interval];

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Votingman/1.0)" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance ${res.status}`);
    }

    const json = (await res.json()) as YahooResult;
    const result = json?.chart?.result?.[0];
    if (!result) {
      throw new Error("Invalid Yahoo response");
    }

    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    const open = quote?.open ?? [];
    const high = quote?.high ?? [];
    const low = quote?.low ?? [];
    const close = quote?.close ?? [];

    const data = timestamps
      .map((t, i) => ({
        time: t as number,
        open: open[i] ?? close[i] ?? 0,
        high: high[i] ?? close[i] ?? 0,
        low: low[i] ?? close[i] ?? 0,
        close: close[i] ?? 0,
      }))
      .filter((c) => c.close > 0);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[kospi-klines] fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: "코스피 차트 데이터를 불러올 수 없습니다.",
        },
      },
      { status: 500 }
    );
  }
}
