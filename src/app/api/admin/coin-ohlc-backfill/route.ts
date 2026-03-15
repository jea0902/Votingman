/**
 * POST /api/admin/coin-ohlc-backfill
 *
 * 관리자 전용: 코인 OHLC(btc_ohlc) 강제 백필
 * - Binance 기반 수집 로직(fetchOhlcForPollDate) 재사용
 * - 현재는 BTC/ETH/XRP 계열 시장만 지원
 *
 * body:
 * {
 *   "market": "btc_1d" | "btc_4h" | "btc_1h" | "btc_15m" | "btc_5m"
 *           | "eth_1d" | "eth_4h" | "eth_1h" | "eth_15m" | "eth_5m"
 *           | "xrp_1d" | "xrp_4h" | "xrp_1h" | "xrp_15m" | "xrp_5m",
 *   "from": "YYYY-MM-DD",
 *   "to": "YYYY-MM-DD"
 * }
 *
 * 제약:
 * - from <= to
 * - 최대 2년(730일) 범위까지만 허용
 *
 * 인증:
 * - (1) Header x-cron-secret = CRON_SECRET
 * - 또는 (2) 관리자 로그인 세션
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { fetchOhlcForPollDate } from "@/lib/binance/btc-klines";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";

const COIN_BACKFILL_MARKETS = [
  "btc_1d",
  "btc_4h",
  "btc_1h",
  "btc_15m",
  "btc_5m",
  "eth_1d",
  "eth_4h",
  "eth_1h",
  "eth_15m",
  "eth_5m",
  "xrp_1d",
  "xrp_4h",
  "xrp_1h",
  "xrp_15m",
  "xrp_5m",
] as const;

type CoinBackfillMarket = (typeof COIN_BACKFILL_MARKETS)[number];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 730; // 최대 2년

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

function diffDaysInclusive(from: string, to: string): number {
  const fromDate = new Date(from + "T00:00:00Z");
  const toDate = new Date(to + "T00:00:00Z");
  const ms = toDate.getTime() - fromDate.getTime();
  if (!Number.isFinite(ms) || ms < 0) return -1;
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

function getDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cur = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
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

  try {
    const body = await request.json().catch(() => ({}));
    const market = body?.market as CoinBackfillMarket | undefined;
    const from = body?.from as string | undefined;
    const to = body?.to as string | undefined;

    if (!market || !from || !to) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "market, from, to 값을 모두 입력해주세요.",
          },
        },
        { status: 400 }
      );
    }

    if (!COIN_BACKFILL_MARKETS.includes(market)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "지원하지 않는 코인 시장입니다.",
          },
        },
        { status: 400 }
      );
    }

    if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "from/to는 YYYY-MM-DD 형식이어야 합니다.",
          },
        },
        { status: 400 }
      );
    }

    const days = diffDaysInclusive(from, to);
    if (days <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "from 날짜가 to 날짜보다 이후일 수 없습니다.",
          },
        },
        { status: 400 }
      );
    }
    if (days > MAX_DAYS) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RANGE_TOO_LARGE",
            message: "최대 2년(730일) 범위까지만 한 번에 백필할 수 있습니다.",
          },
        },
        { status: 400 }
      );
    }

    const pollDates = getDateRange(from, to);

    let totalUpserted = 0;
    const perDate: { poll_date: string; upserted: number }[] = [];

    for (const date of pollDates) {
      const rows = await fetchOhlcForPollDate(market, date);
      const { inserted } = await upsertBtcOhlcBatch(rows);
      totalUpserted += inserted;
      perDate.push({ poll_date: date, upserted: inserted });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `코인 OHLC 백필 완료 (${totalUpserted}건 upsert)`,
        market,
        from,
        to,
        days,
        total_upserted: totalUpserted,
        per_date: perDate,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin/coin-ohlc-backfill] error:", e);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

