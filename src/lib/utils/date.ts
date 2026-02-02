/**
 * 날짜 관련 유틸리티 함수
 * 
 * 설계 의도:
 * - 상대 시간 표시 (방금 전, N분 전, N시간 전, N일 전)
 * - 7일 이후는 절대 날짜 표시
 * - 한국어 로케일 기준
 */

/**
 * 날짜를 상대적 시간 문자열로 변환합니다.
 * 
 * @param dateString - ISO 8601 형식의 날짜 문자열
 * @returns 상대적 시간 문자열 (예: "방금 전", "5분 전", "2024.01.15")
 * 
 * @example
 * formatRelativeDate('2024-01-15T10:30:00Z') // "5분 전"
 * formatRelativeDate('2024-01-10T10:30:00Z') // "5일 전"
 * formatRelativeDate('2024-01-01T10:30:00Z') // "2024. 01. 01."
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
