/**
 * GET /api/sentiment/polls/today-results?market=btc_15m
 * 당일(KST) 봉 결과. 각 봉은 [이전 봉 종가 vs 이 봉 종가]로 상승/하락/동일가 계산.
 * - 코인: btc_ohlc (open=reference, close=settlement)
 * - 한국 지수: korea_ohlc (직전 봉 close vs 현재 봉 close)
 * btc/eth/usdt/xrp 1d,4h,1h,15m,5m + kospi_1d, kospi_1h, kosdaq_1d, kosdaq_1h 지원.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  getTodayKstDateString,
  getTodayUtcDateString,
} from "@/lib/binance/btc-kst";
import { getCandlesForPollDate, getPreviousCandleStartAt } from "@/lib/btc-ohlc/candle-utils";

const COIN_MARKETS = [
  "btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m",
  "eth_1d", "eth_4h", "eth_1h", "eth_15m", "eth_5m",
  "usdt_1d", "usdt_4h", "usdt_1h", "usdt_15m", "usdt_5m",
  "xrp_1d", "xrp_4h", "xrp_1h", "xrp_15m", "xrp_5m",
] as const;

const KOREA_MARKETS = [
  "kospi_1d",
  "kospi_1h",
  "kosdaq_1d",
  "kosdaq_1h",
  "samsung_1d",
  "samsung_1h",
  "skhynix_1d",
  "skhynix_1h",
  "hyundai_1d",
  "hyundai_1h",
] as const;

export type TodayResultItem = {
  candle_start_at: string;
  outcome: "long" | "short" | "draw";
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get("market") ?? "";

    const isCoin = COIN_MARKETS.includes(market as (typeof COIN_MARKETS)[number]);
    const isKorea = KOREA_MARKETS.includes(market as (typeof KOREA_MARKETS)[number]);

    if (!isCoin && !isKorea) {
      return NextResponse.json({
        success: true,
        data: { results: [] },
      });
    }

    const todayKst = getTodayKstDateString();
    const todayUtc = getTodayUtcDateString();
    const pollDate =
      market === "btc_1d" || market === "eth_1d" || market === "usdt_1d" || market === "xrp_1d"
        ? todayUtc
        : todayKst;
    const candleStartAts = getCandlesForPollDate(market, pollDate);
    if (candleStartAts.length === 0) {
      return NextResponse.json({ success: true, data: { results: [] } });
    }

    const admin = createSupabaseAdmin();

    if (isCoin) {
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
    }

    // 한국 지수: 직전 봉 종가 vs 현재 봉 종가
    const prevStarts = candleStartAts.map((c) => getPreviousCandleStartAt(market, c));
    const allStarts = [...new Set([...candleStartAts, ...prevStarts])];

    const { data: ohlcRows, error } = await admin
      .from("korea_ohlc")
      .select("candle_start_at, close")
      .eq("market", market)
      .in("candle_start_at", allStarts);

    if (error || !ohlcRows?.length) {
      return NextResponse.json({
        success: true,
        data: { results: [] },
      });
    }

    const closeByStart = new Map<string, number>();
    for (const row of ohlcRows) {
      const at = typeof row.candle_start_at === "string" ? row.candle_start_at : null;
      const close = Number(row.close);
      if (at && Number.isFinite(close)) closeByStart.set(at, close);
    }

    const results: TodayResultItem[] = [];
    for (const candleStartAt of candleStartAts) {
      const prevStart = getPreviousCandleStartAt(market, candleStartAt);
      const prevClose = closeByStart.get(prevStart);
      const currClose = closeByStart.get(candleStartAt);
      if (prevClose == null || currClose == null || !Number.isFinite(prevClose) || !Number.isFinite(currClose)) continue;
      const outcome: TodayResultItem["outcome"] =
        currClose > prevClose ? "long" : currClose < prevClose ? "short" : "draw";
      results.push({ candle_start_at: candleStartAt, outcome });
    }
    results.sort((a, b) => (b.candle_start_at).localeCompare(a.candle_start_at));

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
