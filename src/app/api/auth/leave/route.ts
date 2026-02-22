// 탈퇴 api

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 회원 탈퇴 API
 *
 * 설계 의도:
 * - 소프트 삭제: users 테이블의 deleted_at에 현재 시각 기록
 * - Supabase Auth 계정은 유지 (미들웨어에서 deleted_at으로 접근 차단)
 * - 게시글/댓글은 그대로 유지
 * - 탈퇴 후 세션 강제 로그아웃
 *
 * 보안:
 * - 세션 기반 본인 인증 (서버 쿠키)
 * - service_role로 users 테이블 업데이트 (RLS 우회)
 */

export async function POST(request: NextRequest) {
  try {
    // 1. 현재 로그인 유저 세션 확인
    const supabaseServer = await createSupabaseServerClient();
    const {
      data: { user },
      error: sessionError,
    } = await supabaseServer.auth.getUser();

    if (sessionError || !user) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 2. 이미 탈퇴한 유저인지 확인
    const supabaseAdmin = createSupabaseAdmin();

    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("user_id, deleted_at, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError || !existingUser) {
      return NextResponse.json(
        { error: "사용자 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (existingUser.deleted_at !== null) {
      return NextResponse.json(
        { error: "이미 탈퇴한 계정입니다." },
        { status: 400 }
      );
    }

    // 3. ADMIN 계정은 탈퇴 불가
    if (existingUser.role === "ADMIN") {
      return NextResponse.json(
        { error: "관리자 계정은 탈퇴할 수 없습니다." },
        { status: 403 }
      );
    }

    // 4. 소프트 삭제: deleted_at 기록
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ deleted_at: now })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to soft delete user:", updateError);
      return NextResponse.json(
        { error: "회원 탈퇴 처리 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    // 5. 세션 로그아웃 (쿠키 삭제)
    const { error: signOutError } = await supabaseServer.auth.signOut();
    if (signOutError) {
      // 탈퇴는 됐지만 로그아웃 실패 → 경고만 남기고 성공 처리
      console.warn("Sign out failed after withdrawal:", signOutError);
    }

    return NextResponse.json(
      { success: true, message: "회원 탈퇴가 완료되었습니다." },
      { status: 200 }
    );
  } catch (err) {
    console.error("Unexpected error in POST /api/auth/leave:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}