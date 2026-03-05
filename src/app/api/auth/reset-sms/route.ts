import { NextRequest, NextResponse } from "next/server";
import { removeVerificationCode, clearAllVerificationCodes } from "@/lib/verification-store";

/**
 * 개발용 SMS 인증 데이터 초기화 API
 * 
 * 개발 환경에서만 사용 가능
 * 메모리에 저장된 인증 데이터를 초기화하여 재테스트 가능
 */

export async function POST(request: NextRequest) {
  // 개발 환경에서만 허용
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: "개발 환경에서만 사용 가능합니다." },
      { status: 403 }
    );
  }

  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      // 전체 초기화
      clearAllVerificationCodes();
      
      return NextResponse.json({
        success: true,
        message: "모든 SMS 인증 데이터가 초기화되었습니다."
      });
    } else {
      // 특정 번호만 초기화
      const deleted = removeVerificationCode(phoneNumber);
      
      return NextResponse.json({
        success: true,
        message: `${phoneNumber} SMS 인증 데이터가 초기화되었습니다.`
      });
    }

  } catch (err) {
    console.error('SMS reset API error:', err);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}