/**
 * POST /api/admin/backfill-and-settle
 * 관리자 전용: 미정산 폴에 대해 OHLC 백필 후 정산
 * - btc_ohlc에 데이터가 없으면 Binance에서 수집 후 정산
 * - btc_1d, btc_4h, btc_1h, btc_15m만 지원
 * body: { pollIds: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { backfillAndSettlePoll } from "@/lib/sentiment/settlement-service";
import { refreshMarketSeason } from "@/lib/tier/tier-service";
import { getCurrentSeasonId } from "@/lib/constants/seasons";
import { TIER_MARKET_ALL } from "@/lib/tier/constants";

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

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json().catch(() => ({}));
    const pollIds = body?.pollIds as string[] | undefined;

    const targetIds = Array.isArray(pollIds) ? pollIds.filter((id) => typeof id === "string") : [];

    if (targetIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "pollIds 배열에 폴 ID를 넣어주세요.",
          },
        },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      targetIds.map((id) => backfillAndSettlePoll(id))
    );

    const settled = results.filter(
      (r) => r.status === "settled" || r.status === "invalid_refund"
    );
    const alreadySettled = results.filter((r) => r.status === "already_settled");
    const notFound = results.filter((r) => r.status === "not_found");
    const unsupported = results.filter((r) => r.status === "unsupported_market");
    const backfilledCount = results.filter(
      (r) => "backfilled" in r && r.backfilled
    ).length;

    if (settled.length > 0) {
      const seasonId = getCurrentSeasonId();
      await refreshMarketSeason(TIER_MARKET_ALL, seasonId);
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `${settled.length}건 정산 완료${backfilledCount > 0 ? ` (${backfilledCount}건 OHLC 백필)` : ""}`,
        settled: settled.length,
        backfilled: backfilledCount,
        already_settled: alreadySettled.length,
        not_found: notFound.length,
        unsupported: results.filter((r) => r.status === "unsupported_market").length,
        results,
      },
    });
  } catch (err) {
    console.error("[admin/backfill-and-settle]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(err) } },
      { status: 500 }
    );
  }
}
