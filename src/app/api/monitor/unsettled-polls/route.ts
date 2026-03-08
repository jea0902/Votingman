/**
 * 크론 실패 시 복구용: 해당 job의 미정산 폴 목록 (캔들 이미 마감됐는데 settled_at 없는 폴)
 *
 * GET /api/monitor/unsettled-polls?job_name=btc-ohlc-4h
 * 인증: (1) x-cron-secret 또는 (2) 로그인 관리자 세션
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { CANDLE_PERIOD_MS } from "@/lib/btc-ohlc/candle-utils";
import { isCronAuthorized } from "@/lib/cron/auth";

const JOB_TO_MARKET: Record<string, string> = {
  "btc-ohlc-daily": "btc_1d",
  "btc-ohlc-4h": "btc_4h",
  "btc-ohlc-1h": "btc_1h",
  "btc-ohlc-15m": "btc_15m",
  "btc-ohlc-5m": "btc_5m",
};

async function isAuthorized(request: NextRequest): Promise<boolean> {
  if (isCronAuthorized(request)) return true;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();
  return data?.role === "ADMIN";
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const jobName = request.nextUrl.searchParams.get("job_name");
  const market = jobName ? JOB_TO_MARKET[jobName] : null;
  if (!market) {
    return NextResponse.json(
      {
        success: false,
        error: "job_name 필요: btc-ohlc-daily, btc-ohlc-4h, btc-ohlc-1h, btc-ohlc-15m, btc-ohlc-5m",
      },
      { status: 400 }
    );
  }

  const periodMs = CANDLE_PERIOD_MS[market];
  if (periodMs == null) {
    return NextResponse.json(
      { success: false, error: `미지원 market: ${market}` },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: polls, error } = await admin
    .from("sentiment_polls")
    .select("id, market, candle_start_at, poll_date, created_at")
    .eq("market", market)
    .is("settled_at", null)
    .not("candle_start_at", "is", null)
    .order("candle_start_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[monitor/unsettled-polls]", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const closed = (polls ?? []).filter((p) => {
    const startMs = new Date(p.candle_start_at).getTime();
    return startMs + periodMs < Date.now();
  });

  return NextResponse.json({
    success: true,
    data: {
      job_name: jobName,
      market,
      unsettled: closed.map((p) => ({
        poll_id: p.id,
        market: p.market,
        candle_start_at: p.candle_start_at,
        poll_date: p.poll_date,
      })),
    },
  });
}
