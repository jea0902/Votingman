import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Auth Callback Route (로그인용)
 * 
 * 설계 의도:
 * - Google OAuth 후 리다이렉트 처리
 * - users 테이블에 존재하는 사용자만 로그인 허용
 * - 미가입 사용자는 회원가입 페이지로 리다이렉트
 * 
 * 보안:
 * - users 테이블 체크로 닉네임 설정 강제
 * - PKCE (code verifier) 자동 처리
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createSupabaseServerClient();

  // Code를 세션으로 교환 (PKCE 자동 처리)
  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
  
  if (sessionError || !sessionData.session) {
    console.error('Session exchange failed:', sessionError);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const userId = sessionData.session.user.id;

  // users 테이블에서 사용자 확인 (인증 상태 체크)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('user_id, nickname, deleted_at, phone_number, phone_verified_at, privacy_agreed_at')
    .eq('user_id', userId)
    .maybeSingle();

    if (userError) {
      console.error('User check failed:', userError);
    }
    
    // users 테이블에 없으면 (= 신규 가입) 닉네임 설정으로
    if (!userData) {
      return NextResponse.redirect(`${origin}/signup?step=nickname`);
    }
    
    // 탈퇴한 유저면 계정 재활성화
    if (userData.deleted_at) {
      const supabaseAdmin = createSupabaseAdmin();
      await supabaseAdmin
        .from('users')
        .update({ deleted_at: null })
        .eq('user_id', userId);
    }

    // 미완료 인증 단계 체크 (기존 사용자용)
    if (!userData.privacy_agreed_at || !userData.phone_verified_at) {
      const missingStep = !userData.privacy_agreed_at ? 'privacy' : 'phone';
      return NextResponse.redirect(`${origin}/signup?step=${missingStep}&existing=true`);
    }
    
    return NextResponse.redirect(`${origin}/home`);
}
