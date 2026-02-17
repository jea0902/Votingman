/**
 * Binance 공개 API로 BTC 시가·종가 조회 (KST 00:00 기준)
 *
 * 설계 의도:
 * - 인간 지표 투표일(poll_date, KST 기준)의 시가 = 당일 KST 00:00 = 전일 15:00 UTC 1h 봉 open
 * - 종가 = 다음날 KST 00:00 = 당일 15:00 UTC 1h 봉 open
 * - Binance GET /api/v3/klines, interval=1h 사용
 */

const BINANCE_KLINES = "https://api.binance.com/api/v3/klines";
const SYMBOL = "BTCUSDT";
const INTERVAL = "1h";

/** poll_date (YYYY-MM-DD, KST 해당일)에 대한 UTC 15:00 시각(ms) 계산 */
function getUtcTimestampsForKstDate(pollDate: string): {
  openUtcMs: number;
  closeUtcMs: number;
} {
  const [y, m, d] = pollDate.split("-").map(Number);
  if (!y || !m || !d) throw new Error("poll_date must be YYYY-MM-DD");
  // 시가: 당일 KST 00:00 = 전일 15:00 UTC
  const openUtcMs = Date.UTC(y, m - 1, d - 1, 15, 0, 0, 0);
  // 종가: 다음날 KST 00:00 = 당일 15:00 UTC
  const closeUtcMs = Date.UTC(y, m - 1, d, 15, 0, 0, 0);
  return { openUtcMs, closeUtcMs };
}

/** Binance 1h 봉 1개 조회, open 가격(문자열) 반환 */
async function fetch1hOpenAt(startTimeMs: number): Promise<string | null> {
  const url = new URL(BINANCE_KLINES);
  url.searchParams.set("symbol", SYMBOL);
  url.searchParams.set("interval", INTERVAL);
  url.searchParams.set("startTime", String(startTimeMs));
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as unknown[];
  if (!Array.isArray(data) || data.length === 0) return null;
  const candle = data[0] as unknown[];
  // [ openTime, open, high, low, close, ... ]
  const openStr = candle[1];
  return typeof openStr === "string" ? openStr : null;
}

export type BtcOpenCloseResult = {
  poll_date: string;
  btc_open: number | null;
  btc_close: number | null;
  open_utc_iso: string;
  close_utc_iso: string;
  /** 종가가 아직 없을 수 있음(당일 15:00 UTC 이전) */
  close_available: boolean;
};

/**
 * 해당 KST 날짜(poll_date)의 BTC 시가·종가 조회.
 * 시가 = 당일 KST 00:00 시점, 종가 = 다음날 KST 00:00 시점 (Binance 1h 봉 open 사용).
 */
export async function fetchBtcOpenCloseKst(
  pollDate: string
): Promise<BtcOpenCloseResult> {
  const { openUtcMs, closeUtcMs } = getUtcTimestampsForKstDate(pollDate);

  const [openStr, closeStr] = await Promise.all([
    fetch1hOpenAt(openUtcMs),
    fetch1hOpenAt(closeUtcMs),
  ]);

  const btc_open = openStr != null ? parseFloat(openStr) : null;
  const btc_close = closeStr != null ? parseFloat(closeStr) : null;
  const now = Date.now();
  const close_available = closeUtcMs <= now;

  return {
    poll_date: pollDate,
    btc_open,
    btc_close,
    open_utc_iso: new Date(openUtcMs).toISOString(),
    close_utc_iso: new Date(closeUtcMs).toISOString(),
    close_available,
  };
}

/** 어제 날짜를 KST 기준 YYYY-MM-DD로 반환 */
export function getYesterdayKstDateString(): string {
  const today = getTodayKstDateString();
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** 오늘 날짜를 KST 기준 YYYY-MM-DD로 반환 */
export function getTodayKstDateString(): string {
  const now = new Date();
  const utcMs = now.getTime();
  const kstMs = utcMs + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 오늘 날짜를 UTC 기준 YYYY-MM-DD로 반환 (btc_1d Binance 정렬용) */
export function getTodayUtcDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 어제 날짜를 UTC 기준 YYYY-MM-DD로 반환 (btc_1d Binance 정렬용) */
export function getYesterdayUtcDateString(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - 1);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST (y,m,d) 00:00:00 의 UTC ms (해당일 00:00 KST = 전일 15:00 UTC) */
function kst00ToUtcMs(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d, 0, 0, 0, 0) - KST_OFFSET_MS;
}

/**
 * 지난 주 월요일 00:00 KST 시각 (UTC ISO).
 * 방금 마감된 주봉 = 이 월요일 00:00 KST에 시작한 7일 봉.
 */
export function getLastMonday00KstIso(): string {
  const now = new Date();
  const kstMs = now.getTime() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  const dayOfWeek = kst.getUTCDay(); // 0=일, 1=월, ..., 6=토
  const daysToThisMonday = dayOfWeek === 0 ? 7 : dayOfWeek; // 일요일이면 7일 전이 월요일
  const lastMondayKstMs = kstMs - (daysToThisMonday + 7) * 24 * 60 * 60 * 1000;
  const lastMon = new Date(lastMondayKstMs);
  const ly = lastMon.getUTCFullYear();
  const lm = lastMon.getUTCMonth() + 1;
  const ld = lastMon.getUTCDate();
  const lastMondayMs = kst00ToUtcMs(ly, lm, ld);
  return new Date(lastMondayMs).toISOString();
}

/**
 * 지난 달 1일 00:00 KST 시각 (UTC ISO).
 * 방금 마감된 월봉 = 이날 00:00 KST에 시작한 해당 월 봉.
 */
export function getLastMonthFirst00KstIso(): string {
  const now = new Date();
  const kstMs = now.getTime() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  let y = kst.getUTCFullYear();
  let m = kst.getUTCMonth() + 1; // 1-12
  m -= 1;
  if (m < 1) {
    m += 12;
    y -= 1;
  }
  const ms = kst00ToUtcMs(y, m, 1);
  return new Date(ms).toISOString();
}

/**
 * 전년 1월 1일 00:00 KST 시각 (UTC ISO).
 * 방금 마감된 연봉 = 이날 00:00 KST에 시작한 12개월 봉.
 */
export function getLastJan100KstIso(): string {
  const now = new Date();
  const kstMs = now.getTime() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear() - 1;
  const ms = kst00ToUtcMs(y, 1, 1);
  return new Date(ms).toISOString();
}

/** 오늘(KST)이 월요일인지 (1W 수집/정산은 월요일만) */
export function isTodayMondayKst(): boolean {
  const kstMs = Date.now() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  return kst.getUTCDay() === 1;
}

/** 오늘(KST)이 매월 1일인지 (1M 수집/정산은 1일만) */
export function isTodayFirstOfMonthKst(): boolean {
  const kstMs = Date.now() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  return kst.getUTCDate() === 1;
}

/** 오늘(KST)이 1월 1일인지 (12M 수집/정산은 1월 1일만) */
export function isTodayJan1Kst(): boolean {
  const kstMs = Date.now() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  return kst.getUTCMonth() === 0 && kst.getUTCDate() === 1;
}
