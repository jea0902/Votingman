/**
 * Yahoo Finance ^KS11 / ^KQ11 OHLC 수집
 * - 1일봉: interval=1d → candle_start_at UTC 00:00 해당일
 * - 1시간봉: interval=1h → candle_start_at UTC 해당 시각(정각)
 */

import type { KoreaOhlcRow } from "./types";
import { getKorea1dCandleStartAtUtc } from "./candle-utils";
import { isTradingDayKST } from "./market-hours";

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

/**
 * 1일봉 수집 (Yahoo 1d → candle_start_at UTC 00:00)
 * @param market kospi_1d | kosdaq_1d
 * @param count 가져올 캔들 수 (최근 N개)
 */
/** 한국 시장별 Yahoo Finance 심볼 */
function getKoreaYahooSymbol(market: string): string {
  if (market.startsWith("kospi")) return "^KS11";
  if (market.startsWith("kosdaq")) return "^KQ11";
  if (market.startsWith("samsung")) return "005930.KS"; // 삼성전자 (코스피)
  if (market.startsWith("skhynix")) return "000660.KS"; // SK 하이닉스 (코스피)
  if (market.startsWith("hyundai")) return "005380.KS"; // 현대자동차 (코스피)
  return "^KS11";
}

export async function fetchKorea1dKlines(
  market: string,
  count: number
): Promise<KoreaOhlcRow[]> {
  const symbol = getKoreaYahooSymbol(market);
  // 크론(최근 1개 등)과 대용량 백필(수년치)을 모두 커버하기 위해
  // - 1년 이하는 "1y"
  // - 그 이상은 "max"로 전체 히스토리 조회
  const range = count <= 365 ? "1y" : "max";
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

    const utcMillis = t * 1000;
    const utcDateStr = timestampToUtcDateStart(t);
    const candleStartAt = getKorea1dCandleStartAtUtc(utcDateStr);

    // 휴장일/주말 필터: KST 기준 거래일이 아닌 날은 스킵
    const kstDate = new Date(utcMillis);
    if (!isTradingDayKST(kstDate)) {
      continue;
    }

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
 * 1시간봉 수집 (Yahoo 1h → candle_start_at UTC 정각)
 * @param market kospi_1h | kosdaq_1h
 * @param count 가져올 1h 캔들 수 (최근 N개)
 */
export async function fetchKorea1hKlines(
  market: string,
  count: number
): Promise<KoreaOhlcRow[]> {
  const symbol = getKoreaYahooSymbol(market);
  const range = "60d"; // 최근 60일 정도
  const { timestamp, open, high, low, close } = await fetchYahooChart(
    symbol,
    "1h",
    range
  );

  const rows: KoreaOhlcRow[] = [];
  const start = Math.max(0, timestamp.length - count);
  for (let i = start; i < timestamp.length; i++) {
    const t = timestamp[i];
    const c = close[i];
    if (!t || c == null || !Number.isFinite(c)) continue;
    const d = new Date(t * 1000);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const hour = d.getUTCHours();
    const candleStartAt = new Date(
      Date.UTC(y, m - 1, day, hour, 0, 0, 0)
    ).toISOString();
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
 * 시장별 최근 N개 캔들 수집 (UTC 기준)
 */
export async function fetchKoreaKlines(
  market: string,
  count: number
): Promise<KoreaOhlcRow[]> {
  if (market === "kospi_1d" || market === "kosdaq_1d" || market === "samsung_1d" || market === "skhynix_1d" || market === "hyundai_1d") {
    return fetchKorea1dKlines(market, count);
  }
  if (market === "kospi_1h" || market === "kosdaq_1h" || market === "samsung_1h" || market === "skhynix_1h" || market === "hyundai_1h") {
    return fetchKorea1hKlines(market, count);
  }
  return [];
}
