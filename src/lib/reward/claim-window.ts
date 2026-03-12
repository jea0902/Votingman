/**
 * 보상 신청 기간 로직
 * - 스냅샷: 매월 마지막 날 22:00 KST
 * - 신청 기간: 마지막 날 22:00 KST ~ 다음날 10:00 KST (10:00 미만)
 */

export function getClaimablePeriodKst(): string | null {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  const h = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  const totalMin = h * 60 + min;

  const lastDay = new Date(y, m, 0).getDate();

  if (d === lastDay && totalMin >= 22 * 60) {
    return `${y}-${String(m).padStart(2, "0")}`;
  }
  if (d === 1 && totalMin < 10 * 60) {
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    return `${prevY}-${String(prevM).padStart(2, "0")}`;
  }
  return null;
}
