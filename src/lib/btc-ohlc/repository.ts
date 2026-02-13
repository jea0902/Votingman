/**
 * btc_ohlc 테이블 upsert
 * - Binance에서 수집한 OHLC를 btc_ohlc에 저장
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { BtcOhlcRow } from "@/lib/binance/btc-klines";

/**
 * 단일 캔들 upsert (market, candle_start_at unique)
 */
export async function upsertBtcOhlc(row: BtcOhlcRow): Promise<void> {
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("btc_ohlc")
    .upsert(
      {
        market: row.market,
        candle_start_at: row.candle_start_at,
        open: row.open,
        close: row.close,
        high: row.high,
        low: row.low,
        updated_at: new Date().toISOString(),
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
  const { data, error } = await admin
    .from("btc_ohlc")
    .select("open, close")
    .eq("market", market)
    .eq("candle_start_at", candleStartAt)
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
 */
export async function upsertBtcOhlcBatch(rows: BtcOhlcRow[]): Promise<{ inserted: number; errors: number }> {
  if (rows.length === 0) return { inserted: 0, errors: 0 };

  const admin = createSupabaseAdmin();
  const payload = rows.map((r) => ({
    market: r.market,
    candle_start_at: r.candle_start_at,
    open: r.open,
    close: r.close,
    high: r.high,
    low: r.low,
  }));

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
