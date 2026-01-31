import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnon } from "@/lib/supabase/server";

/**
 * 닉네임 중복 체크 API
 * 
 * 설계 의도:
 * - 회원가입 시 실시간 닉네임 중복 확인
 * - 소프트 삭제된 사용자 제외
 * 
 * 보안:
 * - SQL Injection: Supabase 파라미터화 쿼리
 * - Rate Limiting: 추후 추가 예정
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get('nickname');

    // 입력 검증
    if (!nickname || nickname.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nickname is required.' },
        { status: 400 }
      );
    }

    if (nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { available: false, reason: '2-20자로 입력해주세요.' },
        { status: 200 }
      );
    }

    const supabase = createSupabaseAnon();

    // 닉네임 중복 체크 (소프트 삭제 제외)
    const { data, error } = await supabase
      .from('users')
      .select('user_id')
      .eq('nickname', nickname.trim())
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('Failed to check nickname:', error);
      return NextResponse.json(
        { error: 'Failed to check nickname.' },
        { status: 500 }
      );
    }

    // 중복 여부 반환
    const available = !data;

    return NextResponse.json(
      { 
        available,
        reason: available ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.'
      },
      { status: 200 }
    );

  } catch (err) {
    console.error('Unexpected error in GET /api/auth/check-nickname:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
