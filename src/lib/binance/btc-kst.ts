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
