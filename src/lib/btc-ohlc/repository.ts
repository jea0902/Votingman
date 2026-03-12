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
import {
  getBtc1dCandleStartAtUtc,
  toCanonicalCandleStartAt,
} from "@/lib/btc-ohlc/candle-utils";

/**
 * 단일 캔들 upsert (market, candle_start_at unique)
 * candle_start_at_kst는 UTC → KST 변환하여 자동 저장
 */
export async function upsertBtcOhlc(row: BtcOhlcRow): Promise<void> {
  const admin = createSupabaseAdmin();
  const candleStartAt = toCanonicalCandleStartAt(row.candle_start_at);
  const utcDate = new Date(candleStartAt);
  const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
  const candleStartAtKst = kstDate.toISOString().replace('T', ' ').substring(0, 19);
  
  const { error } = await admin
    .from("btc_ohlc")
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
      {
        onConflict: "market,candle_start_at",
      }
    );

  if (error) throw error;
}


/**
 * (market, candle_start_at)로 OHLC 조회 — 정산용
 * open = reference_close(시가), close = settlement_close(종가). 모든 시간봉(1d/4h/1h/15m/5m) 공통:
 * 1) 전달된 candle_start_at(호출자가 toCanonicalCandleStartAt 적용 필수)으로 정확히 조회
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

  const exactKey = candleStartAt;

  const { data: exactData, error: exactErr } = await admin
    .from("btc_ohlc")
    .select("open, close")
    .eq("market", market)
    .eq("candle_start_at", exactKey)
    .maybeSingle();

  if (!exactErr && exactData) {
    const out = toResult(exactData);
    if (out) {
      console.error("[btc_ohlc] OHLC 조회 성공 (exact)", { market, exactKey, open: out.open, close: out.close });
      return out;
    }
  }

  // fallback: 1d 코인 시장만 날짜 00:00 UTC로 재시도. 4h/1h/15m/5m은 동일 키로만 재시도(다른 봉 참조 방지)
  let key = exactKey;
  if (market === "btc_1d" || market === "eth_1d" || market === "usdt_1d" || market === "xrp_1d") {
    key = getBtc1dCandleStartAtUtc(exactKey.slice(0, 10));
  }
  const { data, error } = await admin
    .from("btc_ohlc")
    .select("open, close")
    .eq("market", market)
    .eq("candle_start_at", key)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  const out = toResult(data);
  if (out) {
    console.error("[btc_ohlc] OHLC 조회 성공 (fallback)", { market, key, open: out.open, close: out.close });
  }
  return out;
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
    const candleStartAt = toCanonicalCandleStartAt(r.candle_start_at);
    const utcDate = new Date(candleStartAt);
    const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
    const candleStartAtKst = kstDate.toISOString().replace('T', ' ').substring(0, 19);
    
    return {
      market: r.market,
      candle_start_at: candleStartAt,
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
