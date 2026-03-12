/**
 * GET /api/admin/reward-claims?period=YYYY-MM
 * PATCH /api/admin/reward-claims (body: { id, paid: true })
 *
 * 관리자 전용: 월별 보상 신청 목록 조회 및 지급 완료 처리
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } }, { status: 401 }) };
  }

  const { data: userData, error: roleError } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (roleError || !userData || userData.role !== "ADMIN") {
    return { error: NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "관리자만 접근할 수 있습니다." } }, { status: 403 }) };
  }

  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "";

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "period는 YYYY-MM 형식이어야 합니다." } },
      { status: 400 }
    );
  }

  try {
    const admin = createSupabaseAdmin();
    const { data: claims, error } = await admin
      .from("reward_claims")
      .select(`
        id,
        user_id,
        period,
        phone_number,
        privacy_consent,
        paid_at,
        created_at
      `)
      .eq("period", period)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[admin/reward-claims] GET error:", error);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "조회에 실패했습니다." } },
        { status: 500 }
      );
    }

    const userIds = [...new Set((claims ?? []).map((c) => c.user_id))];
    const { data: users } = userIds.length > 0
      ? await admin.from("users").select("user_id, nickname").in("user_id", userIds)
      : { data: [] };

    const userMap = new Map((users ?? []).map((u) => [u.user_id, u.nickname ?? ""]));
    const rows = (claims ?? []).map((c) => ({
      ...c,
      nickname: userMap.get(c.user_id) ?? "-",
    }));

    return NextResponse.json({ success: true, data: { claims: rows } });
  } catch (err) {
    console.error("[admin/reward-claims] Error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const paid = body.paid === true;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "id가 필요합니다." } },
        { status: 400 }
      );
    }

    if (!paid) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "paid: true로 요청해주세요." } },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("reward_claims")
      .update({ paid_at: new Date().toISOString() })
      .eq("id", id)
      .is("paid_at", null);

    if (error) {
      console.error("[admin/reward-claims] PATCH error:", error);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "지급 처리에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { message: "지급 완료 처리되었습니다." } });
  } catch (err) {
    console.error("[admin/reward-claims] Error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
