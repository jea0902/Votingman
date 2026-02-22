import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 매일 OI 데이터 업데이트 API
 *
 * cron-job.org 설정:
 *   URL: https://your-domain.com/api/cron/update-open-interest
 *   Method: GET
 *   Header: x-cron-secret: [환경변수 CRON_SECRET 값]
 *   Schedule: 매일 01:00 UTC (한국시간 오전 10시)
 *
 * 환경변수:
 *   CRON_SECRET          - cron 호출 인증 토큰
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role 키
 */

const BINANCE_FAPI = "https://fapi.binance.com";
const SYMBOL = "BTCUSDT";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // cron 인증 (무단 호출 방지)
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 어제 날짜 기준으로 가져오기
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startTime = new Date(yesterday.toISOString().split("T")[0]).getTime();
    const endTime = startTime + 24 * 60 * 60 * 1000;

    const res = await fetch(
      `${BINANCE_FAPI}/futures/data/openInterestHist?symbol=${SYMBOL}&period=1d&limit=2&startTime=${startTime}&endTime=${endTime}`
    );
    if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
    const data = await res.json();

    if (!data || data.length === 0) {
      return NextResponse.json({ message: "데이터 없음", date: yesterday.toISOString().split("T")[0] });
    }

    const rows = data.map((r: any) => ({
      symbol: SYMBOL,
      date: new Date(r.timestamp).toISOString().split("T")[0],
      oi_value: parseFloat(r.sumOpenInterestValue),
      oi_coins: parseFloat(r.sumOpenInterest),
    }));

    const { error } = await supabaseAdmin
      .from("open_interest_history")
      .upsert(rows, { onConflict: "symbol,date" });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      saved: rows.length,
      date: rows[0].date,
      oi_value: rows[0].oi_value,
    });
  } catch (err) {
    console.error("OI cron error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}