import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * 관리자 전용 닉네임 강제 수정 API
 * 
 * 설계 의도:
 * - 유효성 검사 무시
 * - 중복 허용 (필요시)
 * - 관리자만 사용 가능
 */

export async function POST(request: NextRequest) {
  try {
    const { userId, newNickname, adminPassword } = await request.json();

    // 간단한 관리자 인증 (실제로는 더 강력한 인증 필요)
    if (adminPassword !== process.env.ADMIN_OVERRIDE_PASSWORD) {
      return NextResponse.json(
        { error: "관리자 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 입력 검증
    if (!userId || !newNickname) {
      return NextResponse.json(
        { error: "사용자 ID와 새 닉네임이 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // 기존 닉네임 조회 (로그용)
    const { data: existingUser } = await supabase
      .from('users')
      .select('nickname, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingUser) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 닉네임 강제 수정 (유효성 검사 무시)
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        nickname: newNickname,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Admin nickname update failed:', updateError);
      return NextResponse.json(
        { error: "닉네임 수정에 실패했습니다." },
        { status: 500 }
      );
    }

    // 관리자 로그 기록
    console.log(`🔧 관리자 닉네임 수정: ${existingUser.email}`);
    console.log(`   변경 전: ${existingUser.nickname}`);
    console.log(`   변경 후: ${newNickname}`);

    return NextResponse.json({
      success: true,
      message: "닉네임이 성공적으로 수정되었습니다.",
      oldNickname: existingUser.nickname,
      newNickname: newNickname
    });

  } catch (err) {
    console.error('Admin nickname update API error:', err);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}