/**
 * 크론 상태 모니터링 API
 * cron-job.org에서 주기적으로 호출하여 지연 감지
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

type CronHealthStatus = {
  market: string;
  expected_interval_minutes: number;
  last_candle_utc: string;
  minutes_since_last: number;
  status: "healthy" | "delayed" | "critical";
  missing_candles: number;
};

export async function GET(request: NextRequest) {
  try {
    const admin = createSupabaseAdmin();
    const now = new Date();
    
    // 각 시장별로 개별 쿼리 실행 (Supabase는 GROUP BY 미지원)
    const markets = [];
    for (const market of [
      "btc_5m", "btc_15m", "btc_1h", "btc_4h", "btc_1d",
      "eth_5m", "eth_15m", "eth_1h", "eth_4h", "eth_1d",
    ]) {
      const { data } = await admin
        .from("btc_ohlc")
        .select("candle_start_at")
        .eq("market", market)
        .order("candle_start_at", { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        markets.push({ market, last_candle: data.candle_start_at });
      }
    }
    
    const healthChecks: CronHealthStatus[] = [];
    
    for (const market of markets || []) {
      const lastCandle = new Date(market.last_candle);
      const minutesSince = Math.floor((now.getTime() - lastCandle.getTime()) / (1000 * 60));
      
      let expectedInterval: number;
      let missingCandles: number;
      
      switch (market.market) {
        case "btc_5m":
        case "eth_5m":
          expectedInterval = 5;
          missingCandles = Math.floor(minutesSince / 5);
          break;
        case "btc_15m":
        case "eth_15m":
          expectedInterval = 15;
          missingCandles = Math.floor(minutesSince / 15);
          break;
        case "btc_1h":
        case "eth_1h":
          expectedInterval = 60;
          missingCandles = Math.floor(minutesSince / 60);
          break;
        case "btc_4h":
        case "eth_4h":
          expectedInterval = 240;
          missingCandles = Math.floor(minutesSince / 240);
          break;
        case "btc_1d":
        case "eth_1d":
          expectedInterval = 1440;
          missingCandles = Math.floor(minutesSince / 1440);
          break;
        default:
          continue;
      }
      
      let status: "healthy" | "delayed" | "critical";
      if (missingCandles === 0) {
        status = "healthy";
      } else if (missingCandles <= 2) {
        status = "delayed";
      } else {
        status = "critical";
      }
      
      healthChecks.push({
        market: market.market,
        expected_interval_minutes: expectedInterval,
        last_candle_utc: market.last_candle,
        minutes_since_last: minutesSince,
        status,
        missing_candles: missingCandles,
      });
    }
    
    const overallStatus = healthChecks.some(h => h.status === "critical") 
      ? "critical" 
      : healthChecks.some(h => h.status === "delayed") 
      ? "delayed" 
      : "healthy";
    
    return NextResponse.json({
      success: true,
      data: {
        overall_status: overallStatus,
        timestamp: now.toISOString(),
        markets: healthChecks,
      },
    });
    
  } catch (error) {
    console.error("Cron health check failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "HEALTH_CHECK_FAILED", message: "모니터링 실패" } },
      { status: 500 }
    );
  }
}