/**
 * SMS 인증번호 메모리 저장소
 * 
 * 설계 의도:
 * - 글로벌 저장소로 여러 API에서 공유
 * - 자동 만료 처리
 * - 개발 환경용 (프로덕션에서는 Redis 사용)
 */

interface VerificationData {
  code: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

// 글로벌 메모리 저장소
const globalThis = global as unknown as {
  verificationCodes?: Map<string, VerificationData>;
};

if (!globalThis.verificationCodes) {
  globalThis.verificationCodes = new Map();
}

export const verificationCodes = globalThis.verificationCodes;

// 6자리 랜덤 인증번호 생성
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 인증번호 저장
export function storeVerificationCode(phoneNumber: string, code: string, expiresInSeconds: number): void {
  const now = Date.now();
  const expiresAt = now + (expiresInSeconds * 1000);
  
  verificationCodes.set(phoneNumber, {
    code,
    expiresAt,
    attempts: 0,
    createdAt: now
  });

  console.log(`📱 SMS 저장: ${phoneNumber} -> 코드: ${code} (${expiresInSeconds}초 후 만료)`);
}

// 인증번호 조회
export function getVerificationData(phoneNumber: string): VerificationData | null {
  const data = verificationCodes.get(phoneNumber);
  
  if (!data) {
    console.log(`❌ SMS 조회 실패: ${phoneNumber} (저장된 데이터 없음)`);
    return null;
  }

  // 만료 체크
  if (Date.now() > data.expiresAt) {
    verificationCodes.delete(phoneNumber);
    console.log(`⏰ SMS 만료 삭제: ${phoneNumber}`);
    return null;
  }

  console.log(`✅ SMS 조회 성공: ${phoneNumber} (남은 시간: ${Math.floor((data.expiresAt - Date.now()) / 1000)}초)`);
  return data;
}

// 시도 횟수 증가
export function incrementAttempts(phoneNumber: string): number {
  const data = verificationCodes.get(phoneNumber);
  if (data) {
    data.attempts += 1;
    verificationCodes.set(phoneNumber, data);
    console.log(`🔄 SMS 시도 증가: ${phoneNumber} -> ${data.attempts}번째`);
    return data.attempts;
  }
  return 0;
}

// 인증번호 삭제
export function removeVerificationCode(phoneNumber: string): boolean {
  const deleted = verificationCodes.delete(phoneNumber);
  console.log(`🗑️ SMS 삭제: ${phoneNumber} -> ${deleted ? '성공' : '데이터 없음'}`);
  return deleted;
}

// 모든 인증번호 삭제 (개발용)
export function clearAllVerificationCodes(): void {
  const count = verificationCodes.size;
  verificationCodes.clear();
  console.log(`🧹 SMS 전체 삭제: ${count}개 항목`);
}

// 만료된 코드 정리 (매 10분마다 실행)
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [phone, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(phone);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 SMS 자동 정리: ${cleanedCount}개 만료된 항목 삭제`);
  }
}, 10 * 60 * 1000);