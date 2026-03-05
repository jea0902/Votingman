import { NextRequest, NextResponse } from "next/server";
import { 
  getVerificationData, 
  incrementAttempts, 
  removeVerificationCode,
  verificationCodes
} from "@/lib/verification-store";

/**
 * SMS 인증번호 확인 API
 * 
 * 설계 의도:
 * - send-sms에서 저장한 인증번호와 비교
 * - 3회 실패시 재발송 필요
 * - 3분 초과시 만료 처리
 */

const MAX_ATTEMPTS = 3;

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, code } = await request.json();

    // 디버깅: 요청 데이터 로그
    console.log('🔍 SMS 인증 확인 요청:', {
      phoneNumber,
      code,
      allStoredKeys: Array.from(verificationCodes.keys()),
      storedCount: verificationCodes.size
    });

    // 입력 검증
    if (!phoneNumber || !/^010[0-9]{8}$/.test(phoneNumber)) {
      return NextResponse.json(
        { error: "올바른 휴대폰 번호를 입력해주세요." },
        { status: 400 }
      );
    }

    if (!code || !/^[0-9]{6}$/.test(code)) {
      return NextResponse.json(
        { error: "6자리 인증번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // 저장된 인증번호 조회
    const storedData = getVerificationData(phoneNumber);
    
    if (!storedData) {
      return NextResponse.json(
        { error: "인증번호를 먼저 요청해주세요." },
        { status: 400 }
      );
    }

    // 시도 횟수 체크 (개발 환경에서는 제한 없음)
    if (process.env.NODE_ENV !== 'development' && storedData.attempts >= MAX_ATTEMPTS) {
      removeVerificationCode(phoneNumber);
      return NextResponse.json(
        { error: "인증 시도 횟수를 초과했습니다. 다시 요청해주세요." },
        { status: 400 }
      );
    }

    // 개발 환경: 고정 인증번호 허용
    if (process.env.NODE_ENV === 'development' && code === '123456') {
      removeVerificationCode(phoneNumber);
      
      return NextResponse.json({
        success: true,
        verified: true,
        message: "개발 모드: 휴대폰 인증이 완료되었습니다."
      });
    }

    // 인증번호 확인
    if (storedData.code === code) {
      // 성공: 저장된 데이터 삭제
      removeVerificationCode(phoneNumber);
      
      return NextResponse.json({
        success: true,
        verified: true,
        message: "휴대폰 인증이 완료되었습니다."
      });
    } else {
      // 실패: 시도 횟수 증가
      const attempts = incrementAttempts(phoneNumber);
      const remainingAttempts = MAX_ATTEMPTS - attempts;
      
      return NextResponse.json(
        { 
          error: `인증번호가 일치하지 않습니다. (${remainingAttempts}회 남음)`,
          verified: false,
          remainingAttempts
        },
        { status: 400 }
      );
    }

  } catch (err) {
    console.error('SMS verify API error:', err);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}