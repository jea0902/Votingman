import { NextRequest, NextResponse } from "next/server";
import { getFmpRawData } from "@/lib/supabase/storage";

/**
 * 스토리지 파일 내용 읽기 API
 * - 저장된 JSON 파일 내용 반환
 * - 사용법: /api/fmp/storage/read?ticker=AAPL&date=2026-01-29&type=profile
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ticker = searchParams.get("ticker");
    const date = searchParams.get("date");
    const type = searchParams.get("type") || "profile";

    if (!ticker || !date) {
      return NextResponse.json(
        {
          ok: false,
          error: "ticker와 date 파라미터가 필요합니다.",
          example: "/api/fmp/storage/read?ticker=AAPL&date=2026-01-29&type=profile",
        },
        { status: 400 }
      );
    }

    const validTypes = [
      "profile",
      "income-statement",
      "balance-sheet",
      "cash-flow",
      "key-metrics",
    ] as const;

    if (!validTypes.includes(type as any)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid type. Allowed: ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const data = await getFmpRawData(
      ticker.toUpperCase(),
      type as any,
      date
    );

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: "File not found",
          ticker,
          date,
          type,
          hint: "파일이 존재하지 않거나 읽을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      ticker: ticker.toUpperCase(),
      date,
      type,
      data,
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
