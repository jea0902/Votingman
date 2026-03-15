/**
 * 매 영업일 KST 15:30 직후에 실행: samsung_1d 당일 봉 수집 → korea_ohlc 저장
 * - candle_start_at: 해당 거래일 UTC 00:00 기준
 * - Yahoo 005930.KS(삼성전자) 일봉 수집
 *
 * URL: GET https://<도메인>/api/cron/samsung-ohlc-daily
 * 인증: (1) Header x-cron-secret 또는 Authorization: Bearer <CRON_SECRET>
 *       (2) 쿼리 ?cron_secret=<CRON_SECRET>
 * cron-job.org 등: 타임존 Asia/Seoul, 매 영업일 15:30~15:40 사이 한 번
 */

import { NextResponse } from "next/server";
import { fetchKoreaKlines } from "@/lib/korea-ohlc/yahoo-klines";
import { upsertKoreaOhlcBatch } from "@/lib/korea-ohlc/repository";
import { recordCronError } from "@/lib/monitor/cron-error-log";
import { isCronAuthorized } from "@/lib/cron/auth";
import { getRecentKoreaCandleStartAts } from "@/lib/korea-ohlc/candle-utils";
import { isNowTradingDayKST } from "@/lib/korea-ohlc/market-hours";
import { settlePoll } from "@/lib/sentiment/settlement-service";

const CRON_START_DELAY_MS = 1500;
const MARKET = "samsung_1d";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  await new Promise((r) => setTimeout(r, CRON_START_DELAY_MS));

  try {
    if (!isNowTradingDayKST()) {
      return NextResponse.json({
        success: true,
        data: {
          message: "주말/휴장일, 수집 생략",
          total_fetched: 0,
          upserted: 0,
          errors: 0,
        },
      });
    }

    const rows = await fetchKoreaKlines(MARKET, 1);
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: "samsung_1d 캔들 미수집(Yahoo 빈 응답)",
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
        message: "samsung_1d 수집 및 정산 완료",
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
    console.error("[cron/samsung-ohlc-daily] error:", code, e);
    const context: Record<string, unknown> = { market: MARKET };
    try {
      const startAts = getRecentKoreaCandleStartAts(MARKET, 1);
      if (startAts[0]) context.candle_start_at = startAts[0];
    } catch (_) {}
    try {
      await recordCronError("samsung-ohlc-daily", code, message, context);
    } catch (_) {}
    return NextResponse.json(
      { success: false, error: { code, message, context } },
      { status: 500 }
    );
  }
}
