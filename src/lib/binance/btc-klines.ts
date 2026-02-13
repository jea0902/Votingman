/**
 * Binance 공개 API Klines - 다중 interval 지원
 *
 * btc_ohlc 테이블용: 15m, 1h, 4h, 1d, 1W, 1M, 12M
 * KST 00:00 기준: btc_1d, btc_4h, btc_1h, btc_15m, btc_1W, btc_1M, btc_12M (명세: docs/btc-ohlc-1w-1m-12m-spec.md)
 */

import {
  getCandlesForPollDate,
  getRecentCandleStartAts,
} from "@/lib/btc-ohlc/candle-utils";
import {
  getYesterdayKstDateString,
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
  btc_15m: "15m",
  btc_1h: "1h",
  btc_4h: "4h",
  btc_1d: "1d",
  btc_1W: "1w",
  btc_1M: "1M",
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
  limit = 500
): Promise<BtcOhlcRow[]> {
  const url = new URL(BINANCE_KLINES);
  url.searchParams.set("symbol", SYMBOL);
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

  const rows = await fetchKlines(interval, undefined, limit);
  return rows.map((r) => ({ ...r, market }));
}

/** KST 00:00 정렬 시장 (15m, 1h, 4h, 1d) */
const KST_ALIGNED_MARKETS = ["btc_15m", "btc_1h", "btc_4h", "btc_1d"] as const;

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
  const m = market === "btc" ? "btc_1d" : market;
  if (!KST_ALIGNED_MARKETS.includes(m as (typeof KST_ALIGNED_MARKETS)[number])) {
    return [];
  }

  const startAts = getCandlesForPollDate(m, pollDate);
  if (startAts.length === 0) return [];

  const results: BtcOhlcRow[] = [];

  if (m === "btc_1d") {
    const startMs = new Date(startAts[0]).getTime();
    const rows = await fetchKlines("1h", startMs, 24);
    if (rows.length < 24) return [];
    const first = rows[0];
    const last = rows[23];
    results.push({
      market: m,
      candle_start_at: first.candle_start_at,
      open: first.open,
      close: last.close,
      high: Math.round(Math.max(...rows.map((r) => r.high)) * 100) / 100,
      low: Math.round(Math.min(...rows.map((r) => r.low)) * 100) / 100,
    });
    return results;
  }

  if (m === "btc_4h") {
    for (const startAt of startAts) {
      const startMs = new Date(startAt).getTime();
      const rows = await fetchKlines("1h", startMs, 4);
      if (rows.length < 4) continue;
      const first = rows[0];
      const last = rows[3];
      results.push({
        market: m,
        candle_start_at: first.candle_start_at,
        open: first.open,
        close: last.close,
        high: Math.round(Math.max(...rows.map((r) => r.high)) * 100) / 100,
        low: Math.round(Math.min(...rows.map((r) => r.low)) * 100) / 100,
      });
    }
    return results;
  }

  if (m === "btc_1h" || m === "btc_15m") {
    const interval = m === "btc_1h" ? "1h" : "15m";
    for (const startAt of startAts) {
      const startMs = new Date(startAt).getTime();
      const rows = await fetchKlines(interval, startMs, 1);
      if (rows.length === 0) continue;
      const r = rows[0];
      results.push({ ...r, market: m });
    }
    return results;
  }

  return [];
}

/**
 * KST 00:00 기준 정렬 캔들 수집 (btc_1d, btc_4h, btc_1h, btc_15m)
 * - btc_1d: 1h 24개 집계
 * - btc_4h: 1h 4개 집계
 * - btc_1h, btc_15m: Binance 직접 조회 (startTime 사용)
 */
export async function fetchKlinesKstAligned(
  market: string,
  limit: number
): Promise<BtcOhlcRow[]> {
  const m = market === "btc" ? "btc_1d" : market;
  if (!KST_ALIGNED_MARKETS.includes(m as (typeof KST_ALIGNED_MARKETS)[number])) {
    return [];
  }

  const startAts = getRecentCandleStartAts(m, limit);
  if (startAts.length === 0) return [];

  const results: BtcOhlcRow[] = [];

  if (m === "btc_1d") {
    for (const startAt of startAts) {
      const startMs = new Date(startAt).getTime();
      const rows = await fetchKlines("1h", startMs, 24);
      if (rows.length < 24) continue;
      const first = rows[0];
      const last = rows[23];
      results.push({
        market: m,
        candle_start_at: first.candle_start_at,
        open: first.open,
        close: last.close,
        high: Math.round(Math.max(...rows.map((r) => r.high)) * 100) / 100,
        low: Math.round(Math.min(...rows.map((r) => r.low)) * 100) / 100,
      });
    }
    return results;
  }

  if (m === "btc_4h") {
    for (const startAt of startAts) {
      const startMs = new Date(startAt).getTime();
      const rows = await fetchKlines("1h", startMs, 4);
      if (rows.length < 4) continue;
      const first = rows[0];
      const last = rows[3];
      results.push({
        market: m,
        candle_start_at: first.candle_start_at,
        open: first.open,
        close: last.close,
        high: Math.round(Math.max(...rows.map((r) => r.high)) * 100) / 100,
        low: Math.round(Math.min(...rows.map((r) => r.low)) * 100) / 100,
      });
    }
    return results;
  }

  if (m === "btc_1h" || m === "btc_15m") {
    const interval = m === "btc_1h" ? "1h" : "15m";
    for (const startAt of startAts) {
      const startMs = new Date(startAt).getTime();
      const rows = await fetchKlines(interval, startMs, 1);
      if (rows.length === 0) continue;
      const r = rows[0];
      results.push({
        ...r,
        market: m,
      });
    }
    return results;
  }

  return [];
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
 */
export async function fetchBtc1wKstAligned(): Promise<BtcOhlcRow | null> {
  const startIso = getLastMonday00KstIso();
  const startMs = new Date(startIso).getTime();
  const rows = await fetchKlines("1h", startMs, 168); // 7 * 24
  return aggregate1hToOhlc(rows, "btc_1W");
}

/**
 * 1M 봉: 매월 1일 00:00 KST 기준 해당 월 1h 집계 (명세: docs/btc-ohlc-1w-1m-12m-spec.md)
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
  const yesterday = getYesterdayKstDateString();

  const kstMarkets = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;
  const kstResults = await Promise.all(
    kstMarkets.map((m) => fetchOhlcForPollDate(m, yesterday))
  );

  const utcConfig: { market: string; limit: number }[] = [
    { market: "btc_1W", limit: 3 },
    { market: "btc_1M", limit: 3 },
  ];
  const utcResults = await Promise.all(
    utcConfig.map(({ market, limit }) => fetchLatestCandles(market, limit))
  );

  const all = [...kstResults.flat(), ...utcResults.flat()];

  const candle12M = await fetch12MCandle();
  if (candle12M) all.push(candle12M);

  return all;
}

/**
 * Vercel daily cron 전용: 1d + (해당 날만) 1W + 1M + 12M 수집 (KST 00:00 기준)
 * - 1d: 매일 수집
 * - 1W: 월요일만 수집 (방금 마감된 주봉)
 * - 1M: 매월 1일만 수집 (방금 마감된 월봉)
 * - 12M: 매년 1월 1일만 수집 (방금 마감된 연봉)
 * 명세: docs/btc-ohlc-1w-1m-12m-spec.md
 */
export async function fetchOhlcForDailyCron(): Promise<BtcOhlcRow[]> {
  const yesterday = getYesterdayKstDateString();
  const dayResults = await fetchOhlcForPollDate("btc_1d", yesterday);

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
