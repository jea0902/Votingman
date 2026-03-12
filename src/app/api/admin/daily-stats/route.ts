/**
 * GET /api/admin/daily-stats?period=3m
 *
 * 관리자 전용: active_users_state 일별 집계 조회 (그래프 시각화용)
 * period: "1m" | "3m" | "6m" | "1y" | "all" (기본값: "3m")
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 }
      ),
    };
  }

  const { data: userData, error: roleError } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (roleError || !userData || userData.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "관리자만 접근할 수 있습니다." } },
        { status: 403 }
      ),
    };
  }

  return { user };
}

function getStartDateForPeriod(period: string): string {
  const now = new Date();
  const start = new Date(now);
  switch (period) {
    case "1m":
      start.setMonth(now.getMonth() - 1);
      break;
    case "3m":
      start.setMonth(now.getMonth() - 3);
      break;
    case "6m":
      start.setMonth(now.getMonth() - 6);
      break;
    case "1y":
      start.setFullYear(now.getFullYear() - 1);
      break;
    case "all":
      start.setFullYear(2020, 0, 1);
      break;
    default:
      start.setMonth(now.getMonth() - 3);
  }
  return start.toISOString().split("T")[0];
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "3m";
  const startDateStr = getStartDateForPeriod(period);

  try {
    const admin = createSupabaseAdmin();
    const { data: rows, error } = await admin
      .from("active_users_state")
      .select("stat_date, active_user_count, vote_count")
      .gte("stat_date", startDateStr)
      .order("stat_date", { ascending: true });

    if (error) {
      console.error("[admin/daily-stats] Error:", error);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "조회에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { rows: rows ?? [], period },
    });
  } catch (err) {
    console.error("[admin/daily-stats] Error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
