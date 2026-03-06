/**
 * POST /api/admin/invalidate-polls
 * 관리자 전용: 미정산 폴 강제 무효 처리 (원금 환불 + 투표 중지)
 * body: { pollIds?: string[] } - 지정 시 해당 폴만, 비어있으면 전체 미정산 폴
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { invalidatePollAsAdmin } from "@/lib/sentiment/settlement-service";
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

    const admin = createSupabaseAdmin();

    let targetIds: string[];
    if (Array.isArray(pollIds) && pollIds.length > 0) {
      targetIds = pollIds;
    } else {
      targetIds = [];
    }

    const results = await Promise.all(
      targetIds.map((id) => invalidatePollAsAdmin(id))
    );

    const invalidated = results.filter((r) => r.status === "invalid_refund");
    const alreadySettled = results.filter((r) => r.status === "already_settled");
    const notFound = results.filter((r) => r.status === "not_found");

    if (invalidated.length > 0) {
      const seasonId = getCurrentSeasonId();
      await refreshMarketSeason(TIER_MARKET_ALL, seasonId);
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `${invalidated.length}건 무효 처리 완료`,
        invalidated: invalidated.length,
        already_settled: alreadySettled.length,
        not_found: notFound.length,
        results,
      },
    });
  } catch (err) {
    console.error("[admin/invalidate-polls]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(err) } },
      { status: 500 }
    );
  }
}
