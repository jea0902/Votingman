import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  // users 테이블에서 사용자 확인 (닉네임 설정 여부 체크)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('user_id, nickname')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (userError) {
    console.error('User check failed:', userError);
  }

  // users 테이블에 없으면 (= 닉네임 미설정) 회원가입으로
  if (!userData) {
    return NextResponse.redirect(`${origin}/signup?step=nickname`);
  }

  // users 테이블에 있으면 (= 가입 완료) 홈으로
  return NextResponse.redirect(`${origin}/`);
}
