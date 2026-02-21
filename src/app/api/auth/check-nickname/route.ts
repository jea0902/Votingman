import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * 닉네임 중복 체크 API
 *
 * 설계 의도:
 * - 회원가입/닉네임 수정 시 실시간 닉네임 중복 확인
 * - 소프트 삭제된 사용자 제외
 *
 * users 테이블 RLS로 인해 anon 키는 조회 불가 → service_role(Admin) 사용
 *
 * 보안:
 * - SQL Injection: Supabase 파라미터화 쿼리
 * - Rate Limiting: 추후 추가 예정
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get('nickname');
    const excludeUserId = searchParams.get('exclude_user_id');

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

    const supabase = createSupabaseAdmin();

    // 닉네임 중복 체크 (소프트 삭제 제외)
    let query = supabase
      .from('users')
      .select('user_id')
      .eq('nickname', nickname.trim())
      .is('deleted_at', null);

    // 수정 시 현재 사용자 제외 (자기 닉네임은 사용 가능으로 판정)
    if (excludeUserId && excludeUserId.trim().length > 0) {
      query = query.neq('user_id', excludeUserId.trim());
    }

    const { data, error } = await query.maybeSingle();

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
