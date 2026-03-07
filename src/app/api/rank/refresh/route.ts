/**
 * POST /api/rank/refresh
 * 통합 랭킹(market='all') MMR 재계산 후 user_stats upsert.
 * cron 또는 관리자용.
 */

import { NextResponse } from "next/server";
import { refreshMarketStats } from "@/lib/tier/tier-service";
import { TIER_MARKET_ALL } from "@/lib/tier/constants";

export async function POST() {
  try {
    const { updated } = await refreshMarketStats(TIER_MARKET_ALL);

    return NextResponse.json({
      success: true,
      data: { market: TIER_MARKET_ALL, rows_updated: updated },
    });
  } catch (error) {
    console.error("Rank refresh error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "랭크 갱신에 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
