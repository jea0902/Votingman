import { NextRequest, NextResponse } from "next/server";
import { listTickersByDate } from "@/lib/supabase/storage";

/**
 * 스토리지 파일 목록 조회 API
 * - 특정 날짜의 모든 티커 폴더 목록 반환
 * - 사용법: /api/fmp/storage/list?date=2026-01-29
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        {
          ok: false,
          error: "date 파라미터가 필요합니다.",
          example: "/api/fmp/storage/list?date=2026-01-29",
        },
        { status: 400 }
      );
    }

    const tickers = await listTickersByDate(date);

    return NextResponse.json({
      ok: true,
      date,
      tickerCount: tickers.length,
      tickers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
