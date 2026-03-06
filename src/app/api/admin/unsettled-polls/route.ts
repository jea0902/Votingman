/**
 * GET /api/admin/unsettled-polls
 * 관리자 전용: market 필터별 가장 최근 미정산 폴 1개씩만 반환
 * ?market=btc|kospi|kosdaq|nasdaq|sp500 (기본: btc)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const MARKET_FILTER_TO_DB: Record<string, readonly string[]> = {
  btc: ["btc_1d", "btc_4h", "btc_1h", "btc_15m"],
  kospi: ["kospi"],
  kosdaq: ["kosdaq"],
  nasdaq: ["ndq"],
  sp500: ["sp500"],
} as const;

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "UNAUTHORIZED" as const, data: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (roleError || !userData || userData.role !== "ADMIN") {
    return { error: "FORBIDDEN" as const, data: null };
  }
  return { error: null, data: userData };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
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

  const marketFilter =
    request.nextUrl.searchParams.get("market") ?? "btc";
  const markets =
    MARKET_FILTER_TO_DB[marketFilter] ?? MARKET_FILTER_TO_DB.btc;

  try {
    const admin = createSupabaseAdmin();
    const items: {
      id: string;
      poll_date: string;
      market: string | null;
      candle_start_at: string;
      long_count: number;
      short_count: number;
      total_coin: number;
      vote_count: number;
      created_at: string;
    }[] = [];

    for (const market of markets) {
      const { data: poll, error } = await admin
        .from("sentiment_polls")
        .select("id, poll_date, market, candle_start_at, long_count, short_count, long_coin_total, short_coin_total, created_at")
        .eq("market", market)
        .is("settled_at", null)
        .order("candle_start_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !poll) continue;

      const { count } = await admin
        .from("sentiment_votes")
        .select("*", { count: "exact", head: true })
        .eq("poll_id", poll.id)
        .gt("bet_amount", 0);

      items.push({
        id: poll.id,
        poll_date: poll.poll_date,
        market: poll.market,
        candle_start_at: poll.candle_start_at,
        long_count: poll.long_count ?? 0,
        short_count: poll.short_count ?? 0,
        total_coin: (poll.long_coin_total ?? 0) + (poll.short_coin_total ?? 0),
        vote_count: count ?? 0,
        created_at: poll.created_at,
      });
    }

    // 이미 정산됐지만 집계가 0이 아닌 폴 (무효 처리 후 수동 초기화 필요)
    const { data: needReset } = await admin
      .from("sentiment_polls")
      .select("id, poll_date, market, candle_start_at, long_coin_total, short_coin_total, long_count, short_count")
      .not("settled_at", "is", null)
      .or("long_coin_total.gt.0,short_coin_total.gt.0,long_count.gt.0,short_count.gt.0")
      .in("market", markets)
      .order("candle_start_at", { ascending: false })
      .limit(10);

    const resetItems = (needReset ?? []).map((p) => ({
      id: p.id,
      poll_date: p.poll_date,
      market: p.market,
      candle_start_at: p.candle_start_at,
      total_coin: (p.long_coin_total ?? 0) + (p.short_coin_total ?? 0),
    }));

    return NextResponse.json({
      success: true,
      data: { polls: items, aggregate_reset_needed: resetItems },
    });
  } catch (err) {
    console.error("[admin/unsettled-polls]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}
