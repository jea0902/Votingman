import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Auth Callback Route (회원가입용)
 * 
 * 설계 의도:
 * - Google OAuth 후 리다이렉트 처리
 * - 이미 가입된 사용자는 로그인 페이지로
 * - 미가입 사용자는 닉네임 입력 단계로
 * 
 * 보안:
 * - 중복 가입 방지
 * - PKCE (code verifier) 자동 처리
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/signup`);
  }

  const supabase = await createSupabaseServerClient();

  // Code를 세션으로 교환 (PKCE 자동 처리)
  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
  
  if (sessionError || !sessionData.session) {
    console.error('Session exchange failed:', sessionError);
    return NextResponse.redirect(`${origin}/signup?error=auth_failed`);
  }

  const userId = sessionData.session.user.id;

  // users 테이블에서 사용자 확인
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('user_id, nickname')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (userError) {
    console.error('User check failed:', userError);
  }

  // 이미 가입된 사용자면 로그인 페이지로
  if (userData) {
    return NextResponse.redirect(`${origin}/login?message=already_registered`);
  }

  // 미가입 사용자면 닉네임 입력 단계로
  return NextResponse.redirect(`${origin}/signup?step=nickname`);
}
