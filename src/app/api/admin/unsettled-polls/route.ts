/**
 * GET /api/admin/unsettled-polls
 * 관리자 전용: market 필터별 가장 최근 미정산 폴 1개씩만 반환
 * ?market=btc|kospi|kosdaq|nasdaq|sp500 (기본: btc)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const MARKET_FILTER_TO_DB: Record<string, readonly string[]> = {
  btc: ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m", "eth_1d", "eth_4h", "eth_1h", "eth_15m", "eth_5m", "usdt_1d", "usdt_4h", "usdt_1h", "usdt_15m", "usdt_5m", "xrp_1d", "xrp_4h", "xrp_1h", "xrp_15m", "xrp_5m"],
  eth_1d: ["eth_1d"],
  eth_4h: ["eth_4h"],
  eth_1h: ["eth_1h"],
  eth_15m: ["eth_15m"],
  eth_5m: ["eth_5m"],
  usdt_1d: ["usdt_1d"],
  usdt_4h: ["usdt_4h"],
  usdt_1h: ["usdt_1h"],
  usdt_15m: ["usdt_15m"],
  usdt_5m: ["usdt_5m"],
  xrp_1d: ["xrp_1d"],
  xrp_4h: ["xrp_4h"],
  xrp_1h: ["xrp_1h"],
  xrp_15m: ["xrp_15m"],
  xrp_5m: ["xrp_5m"],
  kospi_1d: ["kospi_1d"],
  kospi_4h: ["kospi_4h"],
  kosdaq_1d: ["kosdaq_1d"],
  kosdaq_4h: ["kosdaq_4h"],
  samsung_1d: ["samsung_1d"],
  samsung_1h: ["samsung_1h"],
  skhynix_1d: ["skhynix_1d"],
  skhynix_1h: ["skhynix_1h"],
  hyundai_1d: ["hyundai_1d"],
  hyundai_1h: ["hyundai_1h"],
  ndq_1d: ["ndq_1d"],
  ndq_4h: ["ndq_4h"],
  nasdaq: ["ndq_1d", "ndq_4h"],
  sp500_1d: ["sp500_1d"],
  sp500_4h: ["sp500_4h"],
  sp500: ["sp500_1d", "sp500_4h"],
  dow_jones_1d: ["dow_jones_1d"],
  dow_jones_4h: ["dow_jones_4h"],
  wti_1d: ["wti_1d"],
  wti_4h: ["wti_4h"],
  xau_1d: ["xau_1d"],
  xau_4h: ["xau_4h"],
  shanghai_1d: ["shanghai_1d"],
  shanghai_4h: ["shanghai_4h"],
  nikkei_1d: ["nikkei_1d"],
  nikkei_4h: ["nikkei_4h"],
  eurostoxx50_1d: ["eurostoxx50_1d"],
  eurostoxx50_4h: ["eurostoxx50_4h"],
  hang_seng_1d: ["hang_seng_1d"],
  hang_seng_4h: ["hang_seng_4h"],
  usd_krw_1d: ["usd_krw_1d"],
  usd_krw_4h: ["usd_krw_4h"],
  jpy_krw_1d: ["jpy_krw_1d"],
  jpy_krw_4h: ["jpy_krw_4h"],
  usd10y_1d: ["usd10y_1d"],
  usd10y_4h: ["usd10y_4h"],
  usd30y_1d: ["usd30y_1d"],
  usd30y_4h: ["usd30y_4h"],
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
