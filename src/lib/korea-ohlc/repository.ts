/**
 * korea_ohlc 테이블 upsert / 조회
 * - candle_start_at: UTC (1일봉 UTC 00:00, 4시간봉 UTC 00/04/08/12/16/20)
 * - candle_start_at_kst: 표시/검증용
 */

import { nowKstString } from "@/lib/kst";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { KoreaOhlcRow } from "./types";
import {
  toCanonicalCandleStartAt,
  getKorea1dCandleStartAtUtc,
} from "./candle-utils";

function utcToKstString(utcIso: string): string {
  const d = new Date(utcIso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace("T", " ").substring(0, 19);
}

/** 단일 캔들 upsert (market, candle_start_at unique) */
export async function upsertKoreaOhlc(row: KoreaOhlcRow): Promise<void> {
  const admin = createSupabaseAdmin();
  const candleStartAt = toCanonicalCandleStartAt(row.candle_start_at);
  const candleStartAtKst = utcToKstString(candleStartAt);

  const { error } = await admin
    .from("korea_ohlc")
    .upsert(
      {
        market: row.market,
        candle_start_at: candleStartAt,
        candle_start_at_kst: candleStartAtKst,
        open: row.open,
        close: row.close,
        high: row.high,
        low: row.low,
        updated_at: nowKstString(),
      },
      { onConflict: "market,candle_start_at" }
    );

  if (error) throw error;
}

/** 여러 캔들 일괄 upsert */
export async function upsertKoreaOhlcBatch(
  rows: KoreaOhlcRow[]
): Promise<{ inserted: number; errors: number }> {
  if (rows.length === 0) return { inserted: 0, errors: 0 };

  const admin = createSupabaseAdmin();
  const kstNow = nowKstString();
  const payload = rows.map((r) => {
    const candleStartAt = toCanonicalCandleStartAt(r.candle_start_at);
    return {
      market: r.market,
      candle_start_at: candleStartAt,
      candle_start_at_kst: utcToKstString(candleStartAt),
      open: r.open,
      close: r.close,
      high: r.high,
      low: r.low,
      updated_at: kstNow,
    };
  });

  const { data, error } = await admin
    .from("korea_ohlc")
    .upsert(payload, { onConflict: "market,candle_start_at" })
    .select("id");

  if (error) throw error;
  const inserted = data?.length ?? 0;
  return { inserted, errors: rows.length - inserted };
}

/**
 * (market, candle_start_at)로 OHLC 조회 — 정산용
 * open = reference_close(시가), close = settlement_close(종가)
 */
export async function getKoreaOhlcByMarketAndCandleStart(
  market: string,
  candleStartAt: string
): Promise<{
  reference_close: number;
  settlement_close: number;
  open: number;
  close: number;
} | null> {
  const admin = createSupabaseAdmin();
  const exactKey = toCanonicalCandleStartAt(candleStartAt);

  const toResult = (
    data: { open: unknown; close: unknown } | null
  ): { reference_close: number; settlement_close: number; open: number; close: number } | null => {
    if (!data) return null;
    const open = Number(data.open);
    const close = Number(data.close);
    if (!Number.isFinite(open) || !Number.isFinite(close)) return null;
    return { reference_close: open, settlement_close: close, open, close };
  };

  const { data: exactData, error: exactErr } = await admin
    .from("korea_ohlc")
    .select("open, close")
    .eq("market", market)
    .eq("candle_start_at", exactKey)
    .maybeSingle();

  if (!exactErr && exactData) {
    return toResult(exactData);
  }

  const is1d = market === "kospi_1d" || market === "kosdaq_1d" || market === "samsung_1d" || market === "skhynix_1d" || market === "hyundai_1d";
  const key = is1d ? getKorea1dCandleStartAtUtc(exactKey.slice(0, 10)) : exactKey;
  const { data, error } = await admin
    .from("korea_ohlc")
    .select("open, close")
    .eq("market", market)
    .eq("candle_start_at", key)
    .maybeSingle();

  if (error || !data) return null;
  return toResult(data);
}

/**
 * 차트용: 시장별 캔들 범위 조회
 * - from/to가 없으면 전체 기간 중 최근 limit개
 * - from/to가 있으면 해당 구간 내에서 최대 limit개 (오래된 것부터 정렬)
 */
export async function getKoreaOhlcRange(
  market: string,
  options: {
    from?: string; // ISO or YYYY-MM-DD
    to?: string; // ISO or YYYY-MM-DD
    limit?: number;
  } = {}
): Promise<
  Array<{
    candle_start_at: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }>
> {
  const admin = createSupabaseAdmin();
  const { from, to } = options;
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 2000);

  let query = admin
    .from("korea_ohlc")
    .select("candle_start_at, open, high, low, close")
    .eq("market", market)
    .order("candle_start_at", { ascending: true })
    .limit(limit);

  if (from) {
    const fromIso = from.length === 10 ? `${from}T00:00:00.000Z` : from;
    query = query.gte("candle_start_at", fromIso);
  }
  if (to) {
    const toIso = to.length === 10 ? `${to}T23:59:59.999Z` : to;
    query = query.lte("candle_start_at", toIso);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => ({
    candle_start_at: row.candle_start_at as string,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
  }));
}
