import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * OI 차트 데이터 조회 API
 *
 * Query params:
 *   period: "1m" | "3m" | "6m" | "1y" | "all" (기본값: "3m")
 *   symbol: "BTCUSDT" (기본값)
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "3m";
  const symbol = searchParams.get("symbol") ?? "BTCUSDT";

  // 기간별 시작일 계산
  const now = new Date();
  const startDate = new Date(now);
  switch (period) {
    case "1m": startDate.setMonth(now.getMonth() - 1); break;
    case "3m": startDate.setMonth(now.getMonth() - 3); break;
    case "6m": startDate.setMonth(now.getMonth() - 6); break;
    case "1y": startDate.setFullYear(now.getFullYear() - 1); break;
    case "all": startDate.setFullYear(2019, 8, 13); break; // 2019-09-13
    default:   startDate.setMonth(now.getMonth() - 3);
  }

  try {
    const { data, error } = await supabase
      .from("open_interest_history")
      .select("date, oi_value, oi_coins")
      .eq("symbol", symbol)
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      symbol,
      period,
      count: data.length,
      data: data ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}