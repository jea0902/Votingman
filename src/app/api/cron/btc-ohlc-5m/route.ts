/**
 * 5분마다 실행: btc_5m 최근 마감 캔들 수집 + 해당 봉 정산
 * - KST 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55분 마감마다
 * - 수집 직후 방금 마감된 캔들에 해당하는 폴 정산
 *
 * GET /api/cron/btc-ohlc-5m
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret
 *
 * cron-job.org: 5분마다 실행 (예: 00:05, 00:10, 00:15, ...)
 */

import { NextResponse } from "next/server";
import { fetchKlinesKstAligned } from "@/lib/binance/btc-klines";
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
    const rows = await fetchKlinesKstAligned("btc_5m", 1);
    const { inserted, errors } = await upsertBtcOhlcBatch(rows);

    let settle = null;
    if (rows.length > 0) {
      const justClosed = rows[0];
      settle = await settlePoll("", "btc_5m", justClosed.candle_start_at);
      if (
        settle.status === "settled" ||
        settle.status === "invalid_refund"
      ) {
        const seasonId = getCurrentSeasonId();
        await refreshMarketSeason(TIER_MARKET_ALL, seasonId);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "btc_5m 수집 및 정산 완료",
        total_fetched: rows.length,
        upserted: inserted,
        errors,
        settle,
      },
    });
  } catch (e) {
    console.error("[cron/btc-ohlc-5m] error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
