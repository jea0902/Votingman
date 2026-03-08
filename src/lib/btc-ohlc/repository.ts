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
  normalizeBtc4hCandleStartAt,
} from "@/lib/btc-ohlc/candle-utils";

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

/**
 * (market, candle_start_at)로 OHLC 조회
 * 정산용: open = 이전 캔들 종가(reference_close), close = 이 캔들 종가(settlement_close)
 * → 종가끼리 비교: reference_close(open) vs settlement_close(close)
 * btc_1d: candle_start_at이 00:00이 아니어도 해당 UTC일의 00:00 봉으로 조회 (잘못 저장된 과거 데이터 호환)
 * btc_4h: 03:00 등 비경계 값이어도 해당 구간 4h 경계(00/04/08/12/16/20 UTC)로 조회
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
  let key = candleStartAt;
  if (market === "btc_1d") {
    key = getBtc1dCandleStartAtUtc(candleStartAt.slice(0, 10));
  } else if (market === "btc_4h") {
    key = normalizeBtc4hCandleStartAt(candleStartAt);
  }
  const { data, error } = await admin
    .from("btc_ohlc")
    .select("open, close")
    .eq("market", market)
    .eq("candle_start_at", key)
    .maybeSingle();

  if (error || !data) return null;

  const open = Number(data.open);
  const close = Number(data.close);
  if (!Number.isFinite(open) || !Number.isFinite(close)) return null;

  return {
    reference_close: open, // 이전 캔들 종가 = 이 캔들 시가
    settlement_close: close,
    open,
    close,
  };
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
