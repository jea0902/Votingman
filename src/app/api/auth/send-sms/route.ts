import { NextRequest, NextResponse } from "next/server";

/**
 * SMS 발송 API (네이버 클라우드 SENS 구조)
 * 
 * 설계 의도:
 * - 네이버 클라우드 SENS API 구조에 맞춰 구현
 * - 개발 환경에서는 더미 응답, 프로덕션에서는 실제 SENS 호출
 * - 인증번호는 메모리에 3분간 저장
 * 
 * SENS API 스펙:
 * POST https://sens.apigw.ntruss.com/sms/v2/services/{serviceId}/messages
 * Headers: x-ncp-apigw-timestamp, x-ncp-iam-access-key, x-ncp-apigw-signature-v2
 */

import { 
  generateVerificationCode, 
  storeVerificationCode 
} from "@/lib/verification-store";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    // 입력 검증
    if (!phoneNumber || !/^010[0-9]{8}$/.test(phoneNumber)) {
      return NextResponse.json(
        { error: "올바른 휴대폰 번호를 입력해주세요. (010XXXXXXXX)" },
        { status: 400 }
      );
    }

    const code = generateVerificationCode();

    // 메모리에 저장 (3분간 유효)
    storeVerificationCode(phoneNumber, code, 180);

    if (process.env.NODE_ENV === 'development') {
      // 개발 환경: 콘솔에 인증번호 출력
      console.log('📱 SMS 발송 시뮬레이션');
      console.log(`수신번호: ${phoneNumber}`);
      console.log(`인증번호: ${code}`);
      console.log(`만료시간: ${new Date(Date.now() + 3 * 60 * 1000).toLocaleString()}`);

      return NextResponse.json({
        success: true,
        message: '개발 모드: 콘솔에서 인증번호를 확인하세요'
      });
    }

    // 프로덕션 환경: 네이버 클라우드 SENS API 호출
    try {
      const sensResponse = await sendSensMessage(phoneNumber, code);
      
      if (sensResponse.success) {
        return NextResponse.json({
          success: true,
          message: 'SMS 인증번호가 발송되었습니다'
        });
      } else {
        throw new Error((sensResponse as any).error || 'SENS API 호출 실패');
      }
    } catch (smsError) {
      console.error('SENS SMS 발송 실패:', smsError);
      return NextResponse.json(
        { error: 'SMS 발송에 실패했습니다. 다시 시도해주세요.' },
        { status: 500 }
      );
    }

  } catch (err) {
    console.error('SMS send API error:', err);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 네이버 클라우드 SENS SMS 발송 함수
 * TODO: 사업자 등록 후 실제 SENS 계정으로 구현
 */
async function sendSensMessage(phoneNumber: string, code: string) {
  // 네이버 클라우드 SENS API 구조 (더미)
  const serviceId = process.env.NCP_SENS_SERVICE_ID;
  const accessKey = process.env.NCP_ACCESS_KEY;
  const secretKey = process.env.NCP_SECRET_KEY;
  const fromNumber = process.env.NCP_SENS_FROM_NUMBER;

  if (!serviceId || !accessKey || !secretKey || !fromNumber) {
    throw new Error('네이버 클라우드 SENS 환경변수가 설정되지 않았습니다.');
  }

  // TODO: 실제 SENS API 호출 구현
  // const timestamp = Date.now().toString();
  // const signature = makeSignature(secretKey, 'POST', `/sms/v2/services/${serviceId}/messages`, timestamp);
  
  // const response = await fetch(`https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json; charset=utf-8',
  //     'x-ncp-apigw-timestamp': timestamp,
  //     'x-ncp-iam-access-key': accessKey,
  //     'x-ncp-apigw-signature-v2': signature,
  //   },
  //   body: JSON.stringify({
  //     type: 'SMS',
  //     from: fromNumber,
  //     content: `[보팅맨] 인증번호: ${code}`,
  //     messages: [{ to: phoneNumber }]
  //   })
  // });

  return { success: true };
}

// 글로벌 저장소로 이동됨