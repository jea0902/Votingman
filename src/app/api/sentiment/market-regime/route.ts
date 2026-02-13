/**
 * GET /api/sentiment/market-regime
 * 현재 시장세 및 과거 같은 장세일 때 롱/숏 당첨률
 * 명세: docs/votingman-implementation-phases.md 5단계
 *
 * Query: market (btc | ndq | sp500 | kospi | kosdaq). btc만 지원, 그 외는 빈 응답.
 */

import { NextRequest, NextResponse } from "next/server";
import { computeMarketRegime } from "@/lib/sentiment/market-regime";
import { isSentimentMarket } from "@/lib/constants/sentiment-markets";

export async function GET(request: NextRequest) {
  try {
    const marketParam = request.nextUrl.searchParams.get("market") ?? "btc_1d";
    const market = isSentimentMarket(marketParam) ? marketParam : "btc_1d";

    const result = await computeMarketRegime(market);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[sentiment/market-regime] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "시장세 정보를 불러오는데 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
