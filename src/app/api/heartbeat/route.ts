import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Heartbeat API — 로그인 유저의 last_active_at 갱신
 *
 * 설계 의도:
 * - 로그인 유저가 주기적으로 호출하여 활동 상태 갱신
 * - 관리자 대시보드의 "최근 5분 내 활성 유저 수" 집계에 사용
 * - RLS: 본인 행만 UPDATE 가능
 */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from("users")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      console.error("[heartbeat] Update failed:", error);
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_FAILED", message: "갱신에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[heartbeat] Error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
