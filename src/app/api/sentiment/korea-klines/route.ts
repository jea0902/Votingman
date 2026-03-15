import { NextRequest, NextResponse } from "next/server";
import { getKoreaOhlcRange } from "@/lib/korea-ohlc/repository";

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
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const limitParam = searchParams.get("limit");

    const isValidMarket = KOREA_MARKETS.includes(marketParam as KoreaMarket);
    if (!isValidMarket) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_MARKET",
            message: "지원하지 않는 한국 시장입니다.",
          },
        },
        { status: 400 }
      );
    }

    const limitRaw = limitParam ? Number(limitParam) : undefined;
    const limit =
      limitRaw && Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

    const rows = await getKoreaOhlcRange(marketParam as KoreaMarket, {
      from,
      to,
      limit,
    });

    const candles = rows.map((r) => {
      const t = new Date(r.candle_start_at).getTime();
      return {
        time: Math.floor(t / 1000), // seconds since epoch (TradingView 호환)
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        market: marketParam,
        candles,
      },
    });
  } catch (error) {
    console.error("[sentiment/korea-klines] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "한국 지수 OHLC를 불러오는데 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }
}

