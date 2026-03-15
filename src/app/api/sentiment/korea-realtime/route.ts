import { NextRequest, NextResponse } from "next/server";
import { fetchKorea1dKlines, fetchKorea1hKlines } from "@/lib/korea-ohlc/yahoo-klines";

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

type KoreaMarket = (typeof KOREA_MARKETS)[number];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketParam = searchParams.get("market") ?? "";

    if (!KOREA_MARKETS.includes(marketParam as KoreaMarket)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_MARKET",
            message: "지원하지 않는 한국 지수 시장입니다.",
          },
        },
        { status: 400 }
      );
    }

    const market = marketParam as KoreaMarket;

    // 1d/1h 각각 Yahoo에서 최근 1개 캔들만 조회 (DB에는 쓰지 않음)
    let rows;
    if (market === "kospi_1d" || market === "kosdaq_1d" || market === "samsung_1d" || market === "skhynix_1d" || market === "hyundai_1d") {
      rows = await fetchKorea1dKlines(market, 1);
    } else {
      rows = await fetchKorea1hKlines(market, 1);
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { price: null },
      });
    }

    const latest = rows[rows.length - 1];

    return NextResponse.json({
      success: true,
      data: {
        price: latest.close,
        candle_start_at: latest.candle_start_at,
        market,
      },
    });
  } catch (error) {
    console.error("[sentiment/korea-realtime] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "한국 지수 현재가를 불러오는데 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }
}

