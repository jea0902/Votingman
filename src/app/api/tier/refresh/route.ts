/**
 * POST /api/tier/refresh
 * 현재 시즌 통합 랭킹(market='all') MMR·티어 재계산 후 user_season_stats upsert.
 * cron 또는 관리자용.
 */

import { NextResponse } from "next/server";
import { refreshMarketSeason } from "@/lib/tier/tier-service";
import { getCurrentSeasonId } from "@/lib/constants/seasons";
import { TIER_MARKET_ALL } from "@/lib/tier/constants";

export async function POST() {
  try {
    const seasonId = getCurrentSeasonId();
    const { updated } = await refreshMarketSeason(TIER_MARKET_ALL, seasonId);

    return NextResponse.json({
      success: true,
      data: { season_id: seasonId, market: TIER_MARKET_ALL, rows_updated: updated },
    });
  } catch (error) {
    console.error("Tier refresh error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "티어 갱신에 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
