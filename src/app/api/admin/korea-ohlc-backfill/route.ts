/**
 * POST /api/admin/korea-ohlc-backfill
 * 관리자 전용: korea_ohlc에 과거 OHLC를 야후에서 백필
 *
 * body:
 * {
 *   "market": "kospi_1d" | "kospi_1h" | "kosdaq_1d" | "kosdaq_1h" | "samsung_1d" | "samsung_1h" | "skhynix_1d" | "skhynix_1h" | "hyundai_1d" | "hyundai_1h",
 *   "from": "YYYY-MM-DD",
 *   "to": "YYYY-MM-DD"
 * }
 *
 * - 인증: (1) Header x-cron-secret = CRON_SECRET 또는 (2) 관리자 로그인 세션
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { fetchKoreaKlines } from "@/lib/korea-ohlc/yahoo-klines";
import { upsertKoreaOhlcBatch } from "@/lib/korea-ohlc/repository";

type BackfillBody = {
  market: "kospi_1d" | "kospi_1h" | "kosdaq_1d" | "kosdaq_1h" | "samsung_1d" | "samsung_1h" | "skhynix_1d" | "skhynix_1h" | "hyundai_1d" | "hyundai_1h";
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function requireAdminOrCron(request: NextRequest) {
  if (isCronAuthorized(request)) return { error: null };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "UNAUTHORIZED" as const };
  }

  const { data: userData, error: roleError } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (roleError || !userData || userData.role !== "ADMIN") {
    return { error: "FORBIDDEN" as const };
  }
  return { error: null };
}

function inRange(candleStartAt: string, from: string, to: string): boolean {
  const d = new Date(candleStartAt);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const ymd = `${y}-${m}-${day}`;
  return ymd >= from && ymd <= to;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrCron(request);
  if (auth.error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: auth.error,
          message:
            auth.error === "UNAUTHORIZED"
              ? "로그인이 필요합니다."
              : "관리자만 접근할 수 있습니다.",
        },
      },
      { status: auth.error === "UNAUTHORIZED" ? 401 : 403 }
    );
  }

  let body: BackfillBody;
  try {
    body = (await request.json()) as BackfillBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_BODY", message: "JSON body를 확인해주세요." } },
      { status: 400 }
    );
  }

  const { market, from, to } = body;
  if (
    !market ||
    !from ||
    !to ||
    !DATE_REGEX.test(from) ||
    !DATE_REGEX.test(to) ||
    (market !== "kospi_1d" &&
      market !== "kospi_1h" &&
      market !== "kosdaq_1d" &&
      market !== "kosdaq_1h" &&
      market !== "samsung_1d" &&
      market !== "samsung_1h" &&
      market !== "skhynix_1d" &&
      market !== "skhynix_1h" &&
      market !== "hyundai_1d" &&
      market !== "hyundai_1h")
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "market(한국 시장 1d/1h), from/to(YYYY-MM-DD)를 올바르게 입력하세요.",
        },
      },
      { status: 400 }
    );
  }

  try {
    // 넉넉히 최근 여러 개를 가져온 뒤 from~to 범위로 필터
    const MAX_COUNT = 2000;
    const rows = await fetchKoreaKlines(market, MAX_COUNT);
    const filtered = rows.filter((r) => inRange(r.candle_start_at, from, to));
    const { inserted, errors } = await upsertKoreaOhlcBatch(filtered);

    return NextResponse.json({
      success: true,
      data: {
        message: "korea_ohlc 백필 완료",
        market,
        from,
        to,
        total_fetched: rows.length,
        total_in_range: filtered.length,
        upserted: inserted,
        errors,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin/korea-ohlc-backfill] error:", e);
    return NextResponse.json(
      { success: false, error: { code: "BACKFILL_ERROR", message } },
      { status: 500 }
    );
  }
}

