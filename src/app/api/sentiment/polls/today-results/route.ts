/**
 * GET /api/sentiment/polls/today-results?market=btc_15m
 * 당일(KST) 봉 결과: btc_ohlc만 사용. 각 봉은 [이전 봉 종가 vs 이 봉 종가]로 상승/하락/동일가 계산.
 * - open = 이전 봉 종가(reference), close = 이 봉 종가(settlement) → close > open: long, close < open: short, 같으면 draw
 * btc_1d, btc_4h, btc_1h, btc_15m 만 지원.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  getTodayKstDateString,
  getTodayUtcDateString,
} from "@/lib/binance/btc-kst";
import { getCandlesForPollDate } from "@/lib/btc-ohlc/candle-utils";

const BTC_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;

export type TodayResultItem = {
  candle_start_at: string;
  outcome: "long" | "short" | "draw";
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get("market") ?? "";

    if (!BTC_MARKETS.includes(market as (typeof BTC_MARKETS)[number])) {
      return NextResponse.json({
        success: true,
        data: { results: [] },
      });
    }

    const todayKst = getTodayKstDateString();
    const todayUtc = getTodayUtcDateString();
    const pollDate = market === "btc_1d" ? todayUtc : todayKst;
    const candleStartAts = getCandlesForPollDate(market, pollDate);
    if (candleStartAts.length === 0) {
      return NextResponse.json({ success: true, data: { results: [] } });
    }

    const admin = createSupabaseAdmin();
    const { data: ohlcRows, error } = await admin
      .from("btc_ohlc")
      .select("candle_start_at, open, close")
      .eq("market", market)
      .in("candle_start_at", candleStartAts)
      .order("candle_start_at", { ascending: false });

    if (error || !ohlcRows?.length) {
      return NextResponse.json({
        success: true,
        data: { results: [] },
      });
    }

    const results: TodayResultItem[] = [];
    for (const row of ohlcRows) {
      const at = typeof row.candle_start_at === "string" ? row.candle_start_at : null;
      const open = Number(row.open);
      const close = Number(row.close);
      if (!at || !Number.isFinite(open) || !Number.isFinite(close)) continue;
      const outcome: TodayResultItem["outcome"] =
        close > open ? "long" : close < open ? "short" : "draw";
      results.push({ candle_start_at: at, outcome });
    }

    return NextResponse.json({
      success: true,
      data: { results },
    });
  } catch (e) {
    console.error("[polls/today-results] error:", e);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "조회 실패" } },
      { status: 500 }
    );
  }
}
