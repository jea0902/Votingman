/**
 * 크론 마지막 실패 에러 조회
 * cron-job.org 등은 500 응답 본문을 안 보여주므로, 실패 시 DB에 저장한 뒤 이 API로 확인
 *
 * GET /api/monitor/cron-errors
 * 인증: (1) x-cron-secret 또는 (2) 로그인 관리자 세션
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCronErrors, getCronErrorHistory } from "@/lib/monitor/cron-error-log";
import { isCronAuthorized } from "@/lib/cron/auth";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  if (isCronAuthorized(request)) return true;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();
  return data?.role === "ADMIN";
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const [errors, history] = await Promise.all([
      getCronErrors(),
      getCronErrorHistory(50),
    ]);
    return NextResponse.json({
      success: true,
      data: { errors, history },
    });
  } catch (e) {
    console.error("[monitor/cron-errors]", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
