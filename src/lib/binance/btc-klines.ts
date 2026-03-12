/**
 * Binance 공개 API Klines - 다중 interval 지원
 *
 * btc_ohlc 테이블용: 15m, 1h, 4h, 1d, 1W, 1M, 12M
 * UTC 네이티브 캔들 사용: Binance 표준 시간대 (UTC 00:00 기준)
 * KST 시간은 candle_start_at_kst 컬럼으로 별도 저장 (데이터 확인용)
 */

import {
  CANDLE_PERIOD_MS,
  getCandlesForPollDate,
  getRecentCandleStartAts,
} from "@/lib/btc-ohlc/candle-utils";
import {
  getYesterdayKstDateString,
  getYesterdayUtcDateString,
  getLastMonday00KstIso,
  getLastMonthFirst00KstIso,
  getLastJan100KstIso,
  isTodayMondayKst,
  isTodayFirstOfMonthKst,
  isTodayJan1Kst,
} from "@/lib/binance/btc-kst";

/** 공개 시세 전용 엔드포인트 사용 (451 지역 제한 완화). 없으면 기본 api.binance.com */
const BINANCE_BASE =
  process.env.BINANCE_API_BASE_URL || "https://data-api.binance.vision";
const BINANCE_KLINES = `${BINANCE_BASE}/api/v3/klines`;
const SYMBOL = "BTCUSDT";

/** btc_ohlc.market → Binance interval (12M 제외) */
export const MARKET_TO_INTERVAL: Record<string, string> = {
  btc_5m: "5m",
  btc_15m: "15m",
  btc_1h: "1h",
  btc_4h: "4h",
  btc_1d: "1d",
  btc_1W: "1w",
  btc_1M: "1M",
  eth_5m: "5m",
  eth_15m: "15m",
  eth_1h: "1h",
  eth_4h: "4h",
  eth_1d: "1d",
  usdt_5m: "5m",
  usdt_15m: "15m",
  usdt_1h: "1h",
  usdt_4h: "4h",
  usdt_1d: "1d",
};

/** market → Binance symbol */
export const MARKET_TO_SYMBOL: Record<string, string> = {
  btc_5m: "BTCUSDT",
  btc_15m: "BTCUSDT",
  btc_1h: "BTCUSDT",
  btc_4h: "BTCUSDT",
  btc_1d: "BTCUSDT",
  btc_1W: "BTCUSDT",
  btc_1M: "BTCUSDT",
  eth_5m: "ETHUSDT",
  eth_15m: "ETHUSDT",
  eth_1h: "ETHUSDT",
  eth_4h: "ETHUSDT",
  eth_1d: "ETHUSDT",
  usdt_5m: "USDTBUSD",
  usdt_15m: "USDTBUSD",
  usdt_1h: "USDTBUSD",
  usdt_4h: "USDTBUSD",
  usdt_1d: "USDTBUSD",
};

export type BtcOhlcRow = {
  market: string;
  candle_start_at: string;
  open: number;
  close: number;
  high: number;
  low: number;
};

/** Binance klines 응답: [openTime, open, high, low, close, volume, ...] */
function parseCandle(row: unknown[]): BtcOhlcRow | null {
  if (!Array.isArray(row) || row.length < 6) return null;
  const openTime = row[0] as number;
  const open = parseFloat(String(row[1]));
  const high = parseFloat(String(row[2]));
  const low = parseFloat(String(row[3]));
  const close = parseFloat(String(row[4]));
  if (!Number.isFinite(open) || !Number.isFinite(close)) return null;
  return {
    market: "",
    candle_start_at: new Date(openTime).toISOString(),
    open: Math.round(open * 100) / 100,
    close: Math.round(close * 100) / 100,
    high: Number.isFinite(high) ? Math.round(high * 100) / 100 : open,
    low: Number.isFinite(low) ? Math.round(low * 100) / 100 : open,
  };
}

/**
 * Binance klines 조회
 * @param interval Binance interval (15m, 1h, 4h, 1d, 1w, 1M)
 * @param startTimeMs 시작 시각 (ms)
 * @param limit 건수 (최대 1000)
 */
export async function fetchKlines(
  interval: string,
  startTimeMs?: number,
  limit = 500,
  symbol?: string
): Promise<BtcOhlcRow[]> {
  const url = new URL(BINANCE_KLINES);
  url.searchParams.set("symbol", symbol ?? SYMBOL);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));
  if (startTimeMs != null) {
    url.searchParams.set("startTime", String(startTimeMs));
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Binance klines ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as unknown[];
  if (!Array.isArray(data)) return [];

  return data
    .map((row) => parseCandle(row as unknown[]))
    .filter((r): r is BtcOhlcRow => r != null);
}

/**
 * 특정 candle_start_at에 해당하는 단일 캔들 조회 (백필용)
 * btc_4h 포함 전부 Binance interval 직접 사용 (UTC 정렬)
 */
export async function fetchCandleByStartAt(
  market: string,
  candleStartAt: string
): Promise<BtcOhlcRow | null> {
  const interval = MARKET_TO_INTERVAL[market];
  if (!interval) return null;
  const symbol = MARKET_TO_SYMBOL[market] ?? SYMBOL;
  const startMs = new Date(candleStartAt).getTime();
  const rows = await fetchKlines(interval, startMs, 1, symbol);
  const r = rows[0];
  return r ? { ...r, market } : null;
}

/**
 * 목표가 = 이전 봉 종가. Binance에서 이전 봉(마감됨) 조회 후 close 반환.
 * btc_ohlc에 없을 때 사용.
 * btc_1d: Binance 1d는 UTC 자정 정렬이라 KST 00:00 봉과 불일치 → 1h 24개 집계해 마지막 봉 종가 사용.
 */
export async function fetchPreviousCandleClose(
  market: string,
  currentCandleStartAt: string
): Promise<number | null> {
  const periodMs = CANDLE_PERIOD_MS[market];
  if (periodMs == null) return null;

  // 모든 시간봉을 네이티브 캔들로 처리
  const interval = MARKET_TO_INTERVAL[market];
  if (!interval) return null;
  const symbol = MARKET_TO_SYMBOL[market] ?? SYMBOL;
  const prevStartMs = new Date(currentCandleStartAt).getTime() - periodMs;
  const rows = await fetchKlines(interval, prevStartMs, 1, symbol);
  const prev = rows[0];
  return prev && Number.isFinite(prev.close) ? prev.close : null;
}

/**
 * btc_1d의 현재 종가 (진행 중 봉). Binance 네이티브 1일봉 직접 조회.
 * btc_ohlc에 없을 때 poll API에서 사용.
 */
export async function fetchCurrentCandleCloseForBtc1dKst(
  candleStartAt: string
): Promise<number | null> {
  const startMs = new Date(candleStartAt).getTime();
  const rows = await fetchKlines("1d", startMs, 1);
  const candle = rows[0];
  return candle && Number.isFinite(candle.close) ? candle.close : null;
}

/**
 * market에 해당하는 최근 마감된 캔들 N개 조회 (UTC 정렬, 1W/1M용)
 * @param market btc_15m, btc_1h, btc_4h, btc_1d, btc_1W, btc_1M
 * @param limit 가져올 캔들 수
 */
export async function fetchLatestCandles(
  market: string,
  limit: number
): Promise<BtcOhlcRow[]> {
  const interval = MARKET_TO_INTERVAL[market];
  if (!interval) return [];

  const symbol = MARKET_TO_SYMBOL[market] ?? SYMBOL;
  const rows = await fetchKlines(interval, undefined, limit, symbol);
  return rows.map((r) => ({ ...r, market }));
}

/** KST 00:00 정렬 시장 (5m, 15m, 1h, 4h, 1d) */
const KST_ALIGNED_MARKETS = [
  "btc_5m", "btc_15m", "btc_1h", "btc_4h", "btc_1d",
  "eth_5m", "eth_15m", "eth_1h", "eth_4h", "eth_1d",
  "usdt_5m", "usdt_15m", "usdt_1h", "usdt_4h", "usdt_1d",
] as const;

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * poll_date(KST)에 해당하는 당일 캔들 수집
 * - btc_1d: 1개
 * - btc_4h: 6개
 * - btc_1h: 24개
 * - btc_15m: 96개
 * open = 이전 캔들 종가(시가), close = 이 캔들 종가 → 종가끼리 비교 정산용
 */
export async function fetchOhlcForPollDate(
  market: string,
  pollDate: string
): Promise<BtcOhlcRow[]> {
  if (!POLL_DATE_REGEX.test(pollDate)) return [];
  const m =
    market === "btc" ? "btc_1d" : market === "eth" ? "eth_1d" : market === "usdt" ? "usdt_1d" : market;
  if (!KST_ALIGNED_MARKETS.includes(m as (typeof KST_ALIGNED_MARKETS)[number])) {
    return [];
  }

  const startAts = getCandlesForPollDate(m, pollDate);
  if (startAts.length === 0) return [];

  const results: BtcOhlcRow[] = [];
  const interval = MARKET_TO_INTERVAL[m];
  if (!interval) return [];

  const symbol = MARKET_TO_SYMBOL[m] ?? SYMBOL;
  for (const startAt of startAts) {
    const startMs = new Date(startAt).getTime();
    const rows = await fetchKlines(interval, startMs, 1, symbol);
    if (rows.length === 0) continue;
    const r = rows[0];
    results.push({ ...r, market: m });
  }
  return results;
}

/**
 * 크론용 최근 마감 캔들 수집 (btc_1d, btc_4h, btc_1h, btc_15m)
 * btc_4h: UTC 00/04/08/12/16/20 (Binance 4h 직접 사용)
 * 그 외 KST 정렬 시장: 1h 집계 등
 */
export async function fetchKlinesKstAligned(
  market: string,
  limit: number
): Promise<BtcOhlcRow[]> {
  const m =
    market === "btc" ? "btc_1d" : market === "eth" ? "eth_1d" : market === "usdt" ? "usdt_1d" : market;
  if (!KST_ALIGNED_MARKETS.includes(m as (typeof KST_ALIGNED_MARKETS)[number])) {
    return [];
  }

  const startAts = getRecentCandleStartAts(m, limit);
  if (startAts.length === 0) return [];

  const results: BtcOhlcRow[] = [];
  const interval = MARKET_TO_INTERVAL[m];
  if (!interval) return [];
  const symbol = MARKET_TO_SYMBOL[m] ?? SYMBOL;

  for (const startAt of startAts) {
    const startMs = new Date(startAt).getTime();
    const rows = await fetchKlines(interval, startMs, 1, symbol);
    if (rows.length === 0) continue;
    const r = rows[0];
    results.push({ ...r, market: m });
  }

  return results;
}

/**
 * 1h 캔들 배열을 하나의 OHLC로 집계 (시가=첫봉 시가, 종가=마지막봉 종가, 고가/저가=max/min)
 */
function aggregate1hToOhlc(rows: BtcOhlcRow[], market: string): BtcOhlcRow | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    market,
    candle_start_at: first.candle_start_at,
    open: first.open,
    close: last.close,
    high: Math.round(Math.max(...rows.map((r) => r.high)) * 100) / 100,
    low: Math.round(Math.min(...rows.map((r) => r.low)) * 100) / 100,
  };
}

/**
 * 1W 봉: 월요일 00:00 KST 기준 7일치 1h 집계 (명세: docs/btc-ohlc-1w-1m-12m-spec.md)
 * @deprecated 미사용. btc_1d만 수집·정산함.
 */
export async function fetchBtc1wKstAligned(): Promise<BtcOhlcRow | null> {
  const startIso = getLastMonday00KstIso();
  const startMs = new Date(startIso).getTime();
  const rows = await fetchKlines("1h", startMs, 168); // 7 * 24
  return aggregate1hToOhlc(rows, "btc_1W");
}

/**
 * 1M 봉: 매월 1일 00:00 KST 기준 해당 월 1h 집계 (명세: docs/btc-ohlc-1w-1m-12m-spec.md)
 * @deprecated 미사용. btc_1d만 수집·정산함.
 */
export async function fetchBtc1mKstAligned(): Promise<BtcOhlcRow | null> {
  const startIso = getLastMonthFirst00KstIso();
  const startMs = new Date(startIso).getTime();
  const kst = new Date(startMs + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  const daysInMonth = new Date(y, m - 1, 0).getDate(); // m은 1-12
  const hours = daysInMonth * 24;
  const rows = await fetchKlines("1h", startMs, Math.min(hours, 1000));
  return aggregate1hToOhlc(rows, "btc_1M");
}

/**
 * 12M 봉: 매년 1월 1일 00:00 KST 기준 12개월 1h 집계 (명세: docs/btc-ohlc-1w-1m-12m-spec.md)
 * @deprecated 미사용. btc_1d만 수집·정산함.
 */
export async function fetchBtc12mKstAligned(): Promise<BtcOhlcRow | null> {
  const startIso = getLastJan100KstIso();
  const startMs = new Date(startIso).getTime();
  const HOURS_12M = 365 * 24;
  const allRows: BtcOhlcRow[] = [];
  let nextMs = startMs;
  const batchSize = 1000;
  while (allRows.length < HOURS_12M) {
    const batch = await fetchKlines("1h", nextMs, batchSize);
    if (batch.length === 0) break;
    allRows.push(...batch);
    if (batch.length < batchSize) break;
    nextMs = new Date(batch[batch.length - 1].candle_start_at).getTime() + 60 * 60 * 1000;
  }
  const rows = allRows.slice(0, HOURS_12M);
  return aggregate1hToOhlc(rows, "btc_12M");
}

/**
 * 12M(12개월) 커스텀: 1d 캔들 기반, 12개월 전 ~ 현재 (UTC 기준, 레거시)
 * @deprecated KST 00:00 기준은 fetchBtc12mKstAligned 사용
 */
export async function fetch12MCandle(): Promise<BtcOhlcRow | null> {
  const now = Date.now();
  const twelveMonthsMs = 365 * 24 * 60 * 60 * 1000;
  const startMs = now - twelveMonthsMs;

  const rows = await fetchKlines("1d", startMs, 400);
  if (rows.length === 0) return null;

  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    market: "btc_12M",
    candle_start_at: first.candle_start_at,
    open: first.open,
    close: last.close,
    high: Math.max(...rows.map((r) => r.high)),
    low: Math.min(...rows.map((r) => r.low)),
  };
}

/**
 * 모든 market(12M 포함) 최신 캔들 수집
 * KST 정렬(btc_1d~15m): 어제 poll_date 기준 1/6/24/96개 수집 (종가끼리 비교 정산용)
 * UTC 정렬(btc_1W, 1M, 12M): 기존 방식
 * (15m/1h/4h는 각각 전용 cron에서 수집하는 것이 권장됨)
 */
export async function fetchAllMarketsOhlc(): Promise<BtcOhlcRow[]> {
  const yesterdayKst = getYesterdayKstDateString();
  const yesterdayUtc = getYesterdayUtcDateString();

  const day1d = await fetchOhlcForPollDate("btc_1d", yesterdayUtc);
  const kstMarkets = ["btc_4h", "btc_1h", "btc_15m", "btc_5m"] as const;
  const kstResults = await Promise.all(
    kstMarkets.map((m) => fetchOhlcForPollDate(m, yesterdayKst))
  );
  const allKst = [...day1d, ...kstResults.flat()];

  const utcConfig: { market: string; limit: number }[] = [
    { market: "btc_1W", limit: 3 },
    { market: "btc_1M", limit: 3 },
  ];
  const utcResults = await Promise.all(
    utcConfig.map(({ market, limit }) => fetchLatestCandles(market, limit))
  );

  const all = [...allKst, ...utcResults.flat()];

  const candle12M = await fetch12MCandle();
  if (candle12M) all.push(candle12M);

  return all;
}

/**
 * 1d + 1W + 1M + 12M 수집 (레거시)
 * @deprecated 미사용. btc-ohlc-daily는 fetchKlinesKstAligned("btc_1d", 1)만 사용. 1W/1M/12M 미사용.
 */
export async function fetchOhlcForDailyCron(): Promise<BtcOhlcRow[]> {
  const yesterdayUtc = getYesterdayUtcDateString();
  const dayResults = await fetchOhlcForPollDate("btc_1d", yesterdayUtc);

  const promises: Promise<BtcOhlcRow | null>[] = [];
  if (isTodayMondayKst()) promises.push(fetchBtc1wKstAligned());
  if (isTodayFirstOfMonthKst()) promises.push(fetchBtc1mKstAligned());
  if (isTodayJan1Kst()) promises.push(fetchBtc12mKstAligned());

  const extra = await Promise.all(promises);
  return [
    ...dayResults,
    ...extra.filter((r): r is BtcOhlcRow => r != null),
  ];
}
