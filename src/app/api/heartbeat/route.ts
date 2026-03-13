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
  let step: string = "init";
  try {
    step = "create-supabase-client";
    const supabase = await createSupabaseServerClient();
    step = "get-user";
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      step = "unauthorized";
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 }
      );
    }

    step = "update-last-active";
    const { error } = await supabase
      .from("users")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      console.error("[heartbeat] Update failed", { step, error });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UPDATE_FAILED",
            message: "갱신에 실패했습니다.",
            step,
          },
        },
        { status: 500 }
      );
    }

    step = "return-success";
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[heartbeat] Error", { step, error: err });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다.",
          step,
        },
      },
      { status: 500 }
    );
  }
}
