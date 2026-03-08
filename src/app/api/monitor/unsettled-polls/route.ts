/**
 * 크론 실패 시 복구용: 해당 job의 미정산 폴 목록
 * - 캔들 이미 마감됐고, settled_at 없고, **투표 참여가 1건 이상인 폴만** (무참여/무효 예정 폴 제외)
 *
 * 캔들 마감 판단: DB의 candle_start_at은 UTC ISO. btc_1d/1h/15m/5m은 Asia/Seoul 크론, btc_4h는 UTC 크론.
 * 공통으로 "마감됨" = candle_start_at(UTC ms) + 봉 주기(ms) < now(UTC).
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

/** DB에서 오는 candle_start_at을 UTC ms로 해석 (타임존 없으면 UTC로 간주) */
function parseCandleStartMs(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  const hasTz = s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s);
  const toParse = hasTz ? s : s.replace(" ", "T") + (s.includes("T") || s.includes(" ") ? "Z" : "");
  const ms = new Date(toParse).getTime();
  return Number.isNaN(ms) ? null : ms;
}

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
  const nowMs = Date.now();

  const { data: polls, error } = await admin
    .from("sentiment_polls")
    .select("id, market, candle_start_at, poll_date, created_at")
    .eq("market", market)
    .is("settled_at", null)
    .not("candle_start_at", "is", null)
    .order("candle_start_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[monitor/unsettled-polls]", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const list = polls ?? [];
  const closed = list.filter((p) => {
    const startMs = parseCandleStartMs(p.candle_start_at);
    if (startMs == null) return false;
    return startMs + periodMs < nowMs;
  });

  if (closed.length === 0) {
    return NextResponse.json({
      success: true,
      data: { job_name: jobName, market, unsettled: [] },
    });
  }

  const pollIds = closed.map((p) => p.id);
  const { data: votes, error: votesErr } = await admin
    .from("sentiment_votes")
    .select("poll_id")
    .in("poll_id", pollIds)
    .gt("bet_amount", 0);

  if (votesErr) {
    console.error("[monitor/unsettled-polls] votes query:", votesErr);
    return NextResponse.json(
      { success: false, error: votesErr.message },
      { status: 500 }
    );
  }

  const pollIdsWithVotes = new Set((votes ?? []).map((v) => v.poll_id));
  const withParticipation = closed.filter((p) => pollIdsWithVotes.has(p.id));

  return NextResponse.json({
    success: true,
    data: {
      job_name: jobName,
      market,
      unsettled: withParticipation.map((p) => ({
        poll_id: p.id,
        market: p.market,
        candle_start_at: p.candle_start_at,
        poll_date: p.poll_date,
      })),
    },
  });
}
