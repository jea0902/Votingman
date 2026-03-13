/** korea_ohlc 테이블 한 행 (수집·upsert용). candle_start_at은 UTC ISO */
export type KoreaOhlcRow = {
  market: string;
  candle_start_at: string;
  open: number;
  high: number;
  low: number;
  close: number;
};
