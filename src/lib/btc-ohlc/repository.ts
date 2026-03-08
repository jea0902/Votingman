/**
 * btc_ohlc 테이블 upsert
 * - Binance에서 수집한 OHLC를 btc_ohlc에 저장 (네이티브 UTC 캔들 사용)
 * - candle_start_at: UTC 시간 (Binance 표준)
 * - candle_start_at_kst: KST 시간 (데이터 확인용)
 * - created_at, updated_at: KST 시간 (관리 편의성)
 */

import { nowKstString } from "@/lib/kst";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { BtcOhlcRow } from "@/lib/binance/btc-klines";
import { getBtc1dCandleStartAtUtc } from "@/lib/btc-ohlc/candle-utils";

/**
 * 단일 캔들 upsert (market, candle_start_at unique)
 * candle_start_at_kst는 UTC → KST 변환하여 자동 저장
 */
export async function upsertBtcOhlc(row: BtcOhlcRow): Promise<void> {
  const admin = createSupabaseAdmin();
  
  // UTC → KST 변환 (candle_start_at + 9시간)
  const utcDate = new Date(row.candle_start_at);
  const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
  const candleStartAtKst = kstDate.toISOString().replace('T', ' ').substring(0, 19);
  
  const { error } = await admin
    .from("btc_ohlc")
    .upsert(
      {
        market: row.market,
        candle_start_at: row.candle_start_at,
        candle_start_at_kst: candleStartAtKst,
        open: row.open,
        close: row.close,
        high: row.high,
        low: row.low,
        updated_at: nowKstString(),
      },
      {
        onConflict: "market,candle_start_at",
      }
    );

  if (error) throw error;
}

/** 타임존 없으면 UTC로 해석. +00/-00 등 짧은 오프셋도 인식 */
function toUtcIso(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (/Z$|[+-]\d{2}(:?\d{2})?$/.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? t : d.toISOString();
  }
  const d = new Date(t.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? t : d.toISOString();
}

/**
 * (market, candle_start_at)로 OHLC 조회 — 정산용
 * open = reference_close(시가), close = settlement_close(종가). 모든 시간봉(1d/4h/1h/15m/5m) 공통:
 * 1) 전달된 candle_start_at을 UTC로 해석 후 정확히 조회(잘못된 봉 비교 방지)
 * 2) 없으면 시장별 정규화 키로 재조회(과거 데이터 호환)
 */
export async function getOhlcByMarketAndCandleStart(
  market: string,
  candleStartAt: string
): Promise<{
  reference_close: number;
  settlement_close: number;
  open: number;
  close: number;
} | null> {
  const admin = createSupabaseAdmin();

  const toResult = (
    data: { open: unknown; close: unknown } | null
  ): { reference_close: number; settlement_close: number; open: number; close: number } | null => {
    if (!data) return null;
    const open = Number(data.open);
    const close = Number(data.close);
    if (!Number.isFinite(open) || !Number.isFinite(close)) return null;
    return { reference_close: open, settlement_close: close, open, close };
  };

  // 타임존 없으면 UTC로 해석 (로컬 해석 시 15m 등에서 잘못된 봉 참조 → 잘못된 판정)
  const candleStartAtUtc = toUtcIso(candleStartAt);
  const exactKey = candleStartAtUtc;

  const { data: exactData, error: exactErr } = await admin
    .from("btc_ohlc")
    .select("open, close")
    .eq("market", market)
    .eq("candle_start_at", exactKey)
    .maybeSingle();

  if (!exactErr && exactData) {
    const out = toResult(exactData);
    if (out) return out;
  }

  // fallback: 1d만 날짜 00:00 UTC로 재시도. 4h/1h/15m/5m은 동일 키로만 재시도(다른 봉 참조 방지)
  let key = candleStartAtUtc;
  if (market === "btc_1d") {
    key = getBtc1dCandleStartAtUtc(candleStartAtUtc.slice(0, 10));
  }
  const { data, error } = await admin
    .from("btc_ohlc")
    .select("open, close")
    .eq("market", market)
    .eq("candle_start_at", key)
    .maybeSingle();

  if (error || !data) return null;
  return toResult(data);
}

/**
 * 여러 캔들 일괄 upsert
 * candle_start_at_kst는 UTC → KST 변환하여 자동 저장
 */
export async function upsertBtcOhlcBatch(rows: BtcOhlcRow[]): Promise<{ inserted: number; errors: number }> {
  if (rows.length === 0) return { inserted: 0, errors: 0 };

  const admin = createSupabaseAdmin();
  const kstNow = nowKstString();
  const payload = rows.map((r) => {
    // UTC → KST 변환 (candle_start_at + 9시간)
    const utcDate = new Date(r.candle_start_at);
    const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
    const candleStartAtKst = kstDate.toISOString().replace('T', ' ').substring(0, 19);
    
    return {
      market: r.market,
      candle_start_at: r.candle_start_at,
      candle_start_at_kst: candleStartAtKst,
      open: r.open,
      close: r.close,
      high: r.high,
      low: r.low,
      updated_at: kstNow,
    };
  });

  const { data, error } = await admin
    .from("btc_ohlc")
    .upsert(payload, {
      onConflict: "market,candle_start_at",
    })
    .select("id");

  if (error) throw error;
  const inserted = data?.length ?? 0;
  return { inserted, errors: rows.length - inserted };
}
