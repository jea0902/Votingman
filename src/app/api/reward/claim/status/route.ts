/**
 * GET /api/reward/claim/status
 *
 * 보상 신청 가능 여부 조회
 * - 신청 기간: 월말 22:00 KST ~ 다음날 10:00 KST
 * - reward_snapshot에 있는 유저만 신청 가능
 * - 이미 신청한 경우 hasClaimed
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getClaimablePeriodKst } from "@/lib/reward/claim-window";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 }
      );
    }

    const period = getClaimablePeriodKst();
    const claimWindowOpen = period !== null;

    if (!claimWindowOpen) {
      return NextResponse.json({
        success: true,
        data: {
          canClaim: false,
          hasClaimed: false,
          inSnapshot: false,
          claimWindowOpen: false,
          period: null,
          rank: null,
        },
      });
    }

    const admin = createSupabaseAdmin();

    const [snapshotRes, claimRes] = await Promise.all([
      admin
        .from("reward_snapshot")
        .select("rank")
        .eq("period", period)
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("reward_claims")
        .select("id")
        .eq("period", period)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const inSnapshot = !!snapshotRes.data;
    const hasClaimed = !!claimRes.data;
    const rank = snapshotRes.data?.rank ?? null;
    const canClaim = claimWindowOpen && inSnapshot && !hasClaimed;

    return NextResponse.json({
      success: true,
      data: {
        canClaim,
        hasClaimed,
        inSnapshot,
        claimWindowOpen: true,
        period,
        rank,
      },
    });
  } catch (e) {
    console.error("[reward/claim/status] Error:", e);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "처리 중 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
