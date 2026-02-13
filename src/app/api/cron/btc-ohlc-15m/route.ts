/**
 * 15분마다 실행: btc_15m 최근 마감 캔들 수집 + 해당 봉 정산
 * - 15:45 KST부터 15분봉 수집 (KST 00, 15, 30, 45분 마감마다)
 * - 수집 직후 방금 마감된 캔들에 해당하는 폴 정산
 *
 * GET /api/cron/btc-ohlc-15m
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret
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
    const rows = await fetchKlinesKstAligned("btc_15m", 8);
    const { inserted, errors } = await upsertBtcOhlcBatch(rows);

    let settle = null;
    if (rows.length > 0) {
      const justClosed = rows[0];
      settle = await settlePoll("", "btc_15m", justClosed.candle_start_at);
      if (
        settle.status === "settled" ||
        settle.status === "one_side_refund" ||
        settle.status === "draw_refund"
      ) {
        const seasonId = getCurrentSeasonId();
        await refreshMarketSeason(TIER_MARKET_ALL, seasonId);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "btc_15m 수집 및 정산 완료",
        total_fetched: rows.length,
        upserted: inserted,
        errors,
        settle,
      },
    });
  } catch (e) {
    console.error("[cron/btc-ohlc-15m] error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
