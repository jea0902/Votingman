import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * 스토리지 파일 삭제 API
 * - 저장된 파일 삭제
 * - 사용법: DELETE /api/fmp/storage/delete?ticker=AAPL&date=2026-01-29&type=profile
 */
export async function DELETE(request: NextRequest) {
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
          example: "DELETE /api/fmp/storage/delete?ticker=AAPL&date=2026-01-29&type=profile",
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

    const supabase = createSupabaseAdmin();
    const filePath = `${date}/${ticker.toUpperCase()}/${type}.json`;

    const { error } = await supabase.storage
      .from("fmp-raw-data")
      .remove([filePath]);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          filePath,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
      ticker: ticker.toUpperCase(),
      date,
      type,
      filePath,
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
