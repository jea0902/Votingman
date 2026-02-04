/**
 * 인간 지표(데일리 투표) 관련 유틸
 *
 * 설계 의도:
 * - 투표 허용 시간: KST 00:00 ~ 20:30 (마감 20:30, 비트코인 예외)
 * - KST 기준 현재 시각으로 마감 여부 판단 (클라이언트/서버 공용)
 */

/** KST 기준 현재 시각 (분 단위로 0시부터 경과) */
export function getKSTMinutesSinceMidnight(): number {
  const now = new Date();
  const utcMs = now.getTime();
  const kstMs = utcMs + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

/**
 * 오늘 KST 00:00 ~ 20:30 이내이면 투표 허용.
 * 20:30 KST 정각 및 이후에는 false (투표 불가).
 * 클라이언트·서버 공용 (API에서도 동일 조건 적용 권장).
 */
export function isVotingOpenKST(): boolean {
  const mins = getKSTMinutesSinceMidnight();
  const closeAt = 20 * 60 + 30; // 20:30 KST (비트코인)
  return mins < closeAt;
}

/** 마감 시각 라벨 (표기용) */
export const VOTING_CLOSE_LABEL = "마감 20:30 (KST)";
