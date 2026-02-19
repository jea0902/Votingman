import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

function getStartOfTodayKst(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const kstDate = formatter.format(new Date());
  return `${kstDate}T00:00:00+09:00`;
}

/**
 * Admin Stats API — 관리자 전용 통계
 *
 * 설계 의도:
 * - /admin 접근 시에만 role 확인
 * - 최근 5분 내 활성 유저, 오늘 가입자/투표/페이지뷰 반환
 */
export async function GET() {
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

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (roleError || !userData || userData.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "관리자만 접근할 수 있습니다." } },
        { status: 403 }
      );
    }

    const admin = createSupabaseAdmin();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const todayStartKst = getStartOfTodayKst();

    const [activeRes, signupRes, voteRes, pageviewRes] = await Promise.all([
      admin
        .from("users")
        .select("*", { count: "exact", head: true })
        .gte("last_active_at", fiveMinutesAgo)
        .is("deleted_at", null),
      admin
        .from("users")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStartKst)
        .is("deleted_at", null),
      admin.from("sentiment_votes").select("*", { count: "exact", head: true }).gte("created_at", todayStartKst),
      admin.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", todayStartKst),
    ]);

    if (activeRes.error) {
      console.error("[admin/stats] Active count failed:", activeRes.error);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "집계에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        activeUserCount: activeRes.count ?? 0,
        todaySignups: signupRes.count ?? 0,
        todayVotes: voteRes.count ?? 0,
        todayPageViews: pageviewRes.count ?? 0,
      },
    });
  } catch (err) {
    console.error("[admin/stats] Error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
