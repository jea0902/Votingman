-- =============================================
-- 008: sentiment_polls OHLC 컬럼명 시장 중립화
-- btc_open → price_open, btc_close → price_close, btc_change_pct → change_pct
-- 실행 후: 코드가 새 컬럼명(price_open, price_close, change_pct)을 사용함
-- =============================================

-- 컬럼 rename (데이터 유지)
ALTER TABLE public.sentiment_polls
  RENAME COLUMN btc_open TO price_open;

ALTER TABLE public.sentiment_polls
  RENAME COLUMN btc_close TO price_close;

ALTER TABLE public.sentiment_polls
  RENAME COLUMN btc_change_pct TO change_pct;

COMMENT ON COLUMN public.sentiment_polls.price_open IS '해당 market의 당일 시가 (USD 등). btc=Binance, kospi/kosdaq/ndq/sp500=해당 지수';
COMMENT ON COLUMN public.sentiment_polls.price_close IS '해당 market의 당일 종가. 다음날 KST 00:00 이후 확정';
COMMENT ON COLUMN public.sentiment_polls.change_pct IS '(price_close - price_open) / price_open * 100';
