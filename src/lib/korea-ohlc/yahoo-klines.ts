/**
 * Yahoo Finance ^KS11 / ^KQ11 OHLC 수집
 * - 1일봉: interval=1d → candle_start_at UTC 00:00 해당일
 * - 4시간봉: interval=1h 수집 후 4봉 집계 → candle_start_at UTC 00/04/08/12/16/20
 */

import type { KoreaOhlcRow } from "./types";
import { getKorea1dCandleStartAtUtc, getKorea4hCandleStartAtUtc } from "./candle-utils";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const USER_AGENT = "Mozilla/5.0 (compatible; Votingman/1.0)";

type YahooQuote = { open?: number[]; high?: number[]; low?: number[]; close?: number[] };
type YahooResult = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: YahooQuote[] };
    }>;
  };
};

/** Yahoo Chart API 호출 (^KS11 또는 ^KQ11) */
async function fetchYahooChart(
  symbol: string,
  interval: "1d" | "1h",
  range: string
): Promise<{ timestamp: number[]; open: number[]; high: number[]; low: number[]; close: number[] }> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
  const json = (await res.json()) as YahooResult;
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("Invalid Yahoo response");
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const open = quote?.open ?? [];
  const high = quote?.high ?? [];
  const low = quote?.low ?? [];
  const close = quote?.close ?? [];
  return { timestamp: timestamps, open, high, low, close };
}

/** Unix 초 → 해당 UTC 날짜 00:00 ISO */
function timestampToUtcDateStart(t: number): string {
  const d = new Date(t * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Unix 초 → UTC 4시간 경계 (00/04/08/12/16/20) ISO */
function timestampToUtc4hStart(t: number): string {
  const d = new Date(t * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const h = d.getUTCHours();
  const slot4h = Math.floor(h / 4);
  return getKorea4hCandleStartAtUtc(
    `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    slot4h
  );
}

/**
 * 1일봉 수집 (Yahoo 1d → candle_start_at UTC 00:00)
 * @param market kospi_1d | kosdaq_1d
 * @param count 가져올 캔들 수 (최근 N개)
 */
export async function fetchKorea1dKlines(
  market: string,
  count: number
): Promise<KoreaOhlcRow[]> {
  const symbol = market.startsWith("kospi") ? "^KS11" : "^KQ11";
  const range = count <= 365 ? "1y" : "2y";
  const { timestamp, open, high, low, close } = await fetchYahooChart(
    symbol,
    "1d",
    range
  );

  const rows: KoreaOhlcRow[] = [];
  const start = Math.max(0, timestamp.length - count);
  for (let i = start; i < timestamp.length; i++) {
    const t = timestamp[i];
    const c = close[i];
    if (!t || c == null || !Number.isFinite(c)) continue;
    const utcDate = timestampToUtcDateStart(t);
    const candleStartAt = getKorea1dCandleStartAtUtc(utcDate);
    rows.push({
      market,
      candle_start_at: candleStartAt,
      open: open[i] ?? c,
      high: high[i] ?? c,
      low: low[i] ?? c,
      close: c,
    });
  }
  return rows;
}

/**
 * 4시간봉 수집 (Yahoo 1h → 4봉씩 집계, candle_start_at UTC 00/04/08/12/16/20)
 * @param market kospi_4h | kosdaq_4h
 * @param count 가져올 4h 캔들 수
 */
export async function fetchKorea4hKlines(
  market: string,
  count: number
): Promise<KoreaOhlcRow[]> {
  const symbol = market.startsWith("kospi") ? "^KS11" : "^KQ11";
  const range = "5d";
  const { timestamp, open, high, low, close } = await fetchYahooChart(
    symbol,
    "1h",
    range
  );

  const rows: KoreaOhlcRow[] = [];
  const needBars = count * 4;
  const start = Math.max(0, timestamp.length - needBars);
  for (let i = start; i + 3 < timestamp.length; i += 4) {
    const o = open[i] ?? close[i];
    const c = close[i + 3];
    if (o == null || c == null || !Number.isFinite(c)) continue;
    const h = Math.max(
      high[i] ?? o,
      high[i + 1] ?? o,
      high[i + 2] ?? o,
      high[i + 3] ?? c
    );
    const l = Math.min(
      low[i] ?? o,
      low[i + 1] ?? o,
      low[i + 2] ?? o,
      low[i + 3] ?? c
    );
    const candleStartAt = timestampToUtc4hStart(timestamp[i]);
    rows.push({
      market,
      candle_start_at: candleStartAt,
      open: o,
      high: h,
      low: l,
      close: c,
    });
  }
  return rows.slice(-count);
}

/**
 * 시장별 최근 N개 캔들 수집 (UTC 기준)
 */
export async function fetchKoreaKlines(
  market: string,
  count: number
): Promise<KoreaOhlcRow[]> {
  if (market === "kospi_1d" || market === "kosdaq_1d") {
    return fetchKorea1dKlines(market, count);
  }
  if (market === "kospi_4h" || market === "kosdaq_4h") {
    return fetchKorea4hKlines(market, count);
  }
  return [];
}
