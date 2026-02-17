/**
 * 예측 대상일(poll_date) 화면 표시용 KST 보정
 *
 * - btc_1d: DB의 poll_date는 UTC 날짜. 봉 마감일(KST) = UTC+1일 이므로 표시 시 +1일
 * - btc_4h, btc_1h, btc_15m: poll_date는 이미 KST → 그대로 반환
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function addOneDayUtc(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * 화면에 "예측 대상일"로 보여줄 때 사용할 날짜(YYYY-MM-DD).
 * btc_1d일 때만 UTC → KST 봉 마감일로 보정, 나머지는 poll_date 그대로.
 */
export function getPollDateDisplayForKst(market: string, pollDate: string): string {
  if (!DATE_REGEX.test(pollDate)) return pollDate;
  if (market === "btc_1d") return addOneDayUtc(pollDate);
  return pollDate;
}
