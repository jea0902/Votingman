/**
 * 매일 KST 00:01에 실행: 1d·1W·1M·12M 수집 + 해당 날만 정산
 *
 * 수집: 1d 매일 / 1W 월요일만 / 1M 매월 1일만 / 12M 매년 1월 1일만
 * 정산: 1d 매일 / 1W 월요일만 / 1M 1일만 / 12M 1월 1일만 (수집과 동일한 날)
 *
 * Vercel cron: "1 15 * * *" = 15:01 UTC = KST 00:01
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret
 */

import { NextResponse } from "next/server";
import { fetchOhlcForDailyCron } from "@/lib/binance/btc-klines";
import {
  getYesterdayUtcDateString,
  getLastMonday00KstIso,
  getLastMonthFirst00KstIso,
  getLastJan100KstIso,
  isTodayMondayKst,
  isTodayFirstOfMonthKst,
  isTodayJan1Kst,
} from "@/lib/binance/btc-kst";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";
import { settlePoll } from "@/lib/sentiment/settlement-service";
import { refreshMarketSeason } from "@/lib/tier/tier-service";
import { getCurrentSeasonId } from "@/lib/constants/seasons";
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
    const rows = await fetchOhlcForDailyCron();
    const { inserted, errors } = await upsertBtcOhlcBatch(rows);

    const yesterdayUtc = getYesterdayUtcDateString();
    const settleResults: Record<string, Awaited<ReturnType<typeof settlePoll>>> = {};

    // 1d: 매일 정산 (UTC 00:00 기준, Binance 1d와 동일)
    settleResults.btc_1d = await settlePoll(yesterdayUtc, "btc_1d");

    // 1W: 월요일만 정산 (방금 마감된 주봉)
    if (isTodayMondayKst()) {
      settleResults.btc_1W = await settlePoll("", "btc_1W", getLastMonday00KstIso());
    }
    // 1M: 매월 1일만 정산 (방금 마감된 월봉)
    if (isTodayFirstOfMonthKst()) {
      settleResults.btc_1M = await settlePoll("", "btc_1M", getLastMonthFirst00KstIso());
    }
    // 12M: 매년 1월 1일만 정산 (방금 마감된 연봉)
    if (isTodayJan1Kst()) {
      settleResults.btc_12M = await settlePoll("", "btc_12M", getLastJan100KstIso());
    }

    const anySettled = Object.values(settleResults).some(
      (r) =>
        r.status === "settled" ||
        r.status === "one_side_refund" ||
        r.status === "draw_refund"
    );
    if (anySettled) {
      const seasonId = getCurrentSeasonId();
      await refreshMarketSeason(TIER_MARKET_ALL, seasonId);
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "btc_ohlc 수집 및 정산 완료",
        total_fetched: rows.length,
        upserted: inserted,
        errors,
        settle: settleResults,
      },
    });
  } catch (e) {
    console.error("[cron/btc-ohlc-daily] error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
