/**
 * 매 영업일 KST 10:00~15:00 정각에 실행: kospi_1h 직전 1시간 봉 수집 → korea_ohlc 저장
 * - 예) 10:00 실행 시 09:00~10:00 KST 1시간봉, 15:00 실행 시 14:00~15:00 KST 1시간봉
 * - Yahoo ^KS11 1시간봉(interval=1h) 수집
 *
 * URL: GET https://<도메인>/api/cron/kospi-ohlc-1h
 * 인증: (1) Header x-cron-secret 또는 Authorization: Bearer <CRON_SECRET>
 *       (2) 쿼리 ?cron_secret=<CRON_SECRET>
 * cron-job.org 등: 타임존 Asia/Seoul, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00
 */

import { NextResponse } from "next/server";
import { fetchKoreaKlines } from "@/lib/korea-ohlc/yahoo-klines";
import { upsertKoreaOhlcBatch } from "@/lib/korea-ohlc/repository";
import { recordCronError } from "@/lib/monitor/cron-error-log";
import { getCronSecret, isCronAuthorized } from "@/lib/cron/auth";
import { getRecentKoreaCandleStartAts } from "@/lib/korea-ohlc/candle-utils";
import {
  isNowTradingDayKST,
  isTradingHourKST,
} from "@/lib/korea-ohlc/market-hours";
import { settlePoll } from "@/lib/sentiment/settlement-service";

const CRON_START_DELAY_MS = 1500;
const MARKET = "kospi_1h";

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

  await new Promise((r) => setTimeout(r, CRON_START_DELAY_MS));

  try {
    const now = new Date();
    if (!isNowTradingDayKST() || !isTradingHourKST(now)) {
      return NextResponse.json({
        success: true,
        data: {
          message: "휴장일/장 시간 외, 수집 생략",
          total_fetched: 0,
          upserted: 0,
          errors: 0,
        },
      });
    }

    // 최근 1개 1시간봉만 수집
    const rows = await fetchKoreaKlines(MARKET, 1);
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: "kospi_1h 캔들 미수집(Yahoo 빈 응답)",
          total_fetched: 0,
          upserted: 0,
          errors: 0,
        },
      });
    }

    const { inserted, errors } = await upsertKoreaOhlcBatch(rows);

    const justClosed = rows[0];
    const settle = await settlePoll("", MARKET, justClosed.candle_start_at);

    return NextResponse.json({
      success: true,
      data: {
        message: "kospi_1h 수집 및 정산 완료",
        total_fetched: rows.length,
        upserted: inserted,
        errors,
        candle_start_at: justClosed.candle_start_at,
        settle,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const code = message.includes("Yahoo")
      ? "YAHOO_ERROR"
      : message.includes("korea_ohlc") || message.includes("upsert")
        ? "DB_UPSERT_ERROR"
        : "CRON_ERROR";
    console.error("[cron/kospi-ohlc-1h] error:", code, e);
    const context: Record<string, unknown> = { market: MARKET };
    try {
      const startAts = getRecentKoreaCandleStartAts(MARKET, 1);
      if (startAts[0]) context.candle_start_at = startAts[0];
    } catch (_) {}
    try {
      await recordCronError("kospi-ohlc-1h", code, message, context);
    } catch (_) {}
    return NextResponse.json(
      { success: false, error: { code, message, context } },
      { status: 500 }
    );
  }
}

