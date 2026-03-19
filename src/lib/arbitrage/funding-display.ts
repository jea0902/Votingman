/**
 * 펀딩비 표시·API 행 필터 공통 기준
 * |rate|가 이 값 미만이면 테이블에서 '-' 처리, API에서는 행 후보에서 제외
 * (소수: 0.001 = 0.1%)
 */
export const FUNDING_DISPLAY_THRESHOLD = 0.001;
