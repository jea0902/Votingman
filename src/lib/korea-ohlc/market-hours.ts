/**
 * 한국 거래소(코스피/코스닥) 거래 시간
 * - 상세: docs/korea-ohlc-roadmap.md §0 (한국 증시 거래·휴장 기준 2026년)
 * - 정규장: 평일 09:00~15:30 KST. 시간외·연초 10:00 개장·ATS 확대는 미반영.
 * - 휴장: 주말(토·일) + src/data/korea-market-holidays.json 기준 휴장일.
 * - 코인과 달리 24시간이 아니므로, 장 마감 구간에는 수집 생략
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 해당 시각을 KST로 변환한 Date */
function toKstDate(date: Date): Date {
  const kstMs = date.getTime() + KST_OFFSET_MS;
  return new Date(kstMs);
}

/** 해당 시각이 KST 기준 평일(월~금)인지 */
export function isWeekdayKST(date: Date): boolean {
  const kst = toKstDate(date);
  const day = kst.getUTCDay();
  return day >= 1 && day <= 5;
}

/** yyyy-mm-dd 문자열 생성 (KST 기준) */
function formatKstDate(date: Date): string {
  const kst = toKstDate(date);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 2026년 휴장일: src/data/korea-market-holidays.json 기준
const KOREA_HOLIDAYS_2026 = new Set<string>([
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-03-01",
  "2026-03-02",
  "2026-05-01",
  "2026-05-05",
  "2026-05-24",
  "2026-05-25",
  "2026-06-03",
  "2026-06-06",
  "2026-07-17",
  "2026-08-15",
  "2026-08-17",
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-10-03",
  "2026-10-05",
  "2026-10-09",
  "2026-12-25",
  "2026-12-31",
]);

/** 해당 시각(KST 기준 날짜)이 휴장일인지 (주말 제외, 공휴일/연말/근로자의날 등) */
export function isHolidayKST(date: Date): boolean {
  const ymd = formatKstDate(date);
  if (ymd.startsWith("2026-")) {
    return KOREA_HOLIDAYS_2026.has(ymd);
  }
  return false;
}

/** 해당 시각이 KST 기준 "거래일"(영업일)인지: 평일 + 휴장 JSON에 없는 날 */
export function isTradingDayKST(date: Date): boolean {
  return isWeekdayKST(date) && !isHolidayKST(date);
}

/** 현재 시각이 KST 기준 거래일인지 (일봉/1시간봉 Cron에서 공통 사용) */
export function isNowTradingDayKST(): boolean {
  return isTradingDayKST(new Date());
}

/** 해당 시각이 KST 기준 정규장 시간대(09:00~15:30) 안인지 */
export function isTradingTimeKST(date: Date): boolean {
  const kst = toKstDate(date);
  const hour = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  const totalMinutes = hour * 60 + minute; // 0~1440
  const start = 9 * 60; // 09:00
  const end = 15 * 60 + 30; // 15:30
  return totalMinutes >= start && totalMinutes <= end;
}

/** 1시간봉 Cron용: 현재 KST 시각이 직전 1시간봉 수집 대상인지 (예: 10:00~15:00 정각) */
export function isTradingHourKST(date: Date): boolean {
  const kst = toKstDate(date);
  const hour = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  // 10:00, 11:00, 12:00, 13:00, 14:00, 15:00 정각만 유효
  if (minute !== 0) return false;
  return hour >= 10 && hour <= 15;
}
