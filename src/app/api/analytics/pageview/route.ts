import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Pageview API — 페이지뷰 로그
 *
 * 설계 의도:
 * - 클라이언트에서 페이지 진입 시 호출
 * - 관리자 대시보드 "오늘 페이지뷰" 집계에 사용
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const path = typeof body.path === "string" ? body.path : "/";

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = createSupabaseAdmin();
    const { error } = await admin.from("page_views").insert({
      path: path.slice(0, 500),
      user_id: user?.id ?? null,
    });

    if (error) {
      console.error("[pageview] Insert failed:", error);
      return NextResponse.json(
        { success: false, error: { code: "INSERT_FAILED", message: "로그 실패" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[pageview] Error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}
