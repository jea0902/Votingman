-- korea_ohlc: 코스피/코스닥 등 국내 지수 OHLC (Yahoo Finance ^KS11, ^KQ11 수집)
-- btc_ohlc와 동일 스키마. 정산 시 open=reference_close(시가), close=settlement_close(종가) 사용

CREATE TABLE public.korea_ohlc (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  market text NOT NULL,
  candle_start_at timestamp with time zone NOT NULL,
  open numeric(18, 4) NOT NULL,
  close numeric(18, 4) NOT NULL,
  high numeric(18, 4) NULL,
  low numeric(18, 4) NULL,
  created_at timestamp without time zone NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Seoul'::text),
  updated_at timestamp without time zone NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Seoul'::text),
  candle_start_at_kst timestamp without time zone NULL,
  CONSTRAINT korea_ohlc_pkey PRIMARY KEY (id),
  CONSTRAINT korea_ohlc_market_start_unique UNIQUE (market, candle_start_at)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_korea_ohlc_market ON public.korea_ohlc USING btree (market) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_korea_ohlc_market_start ON public.korea_ohlc USING btree (market, candle_start_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_korea_ohlc_candle_start ON public.korea_ohlc USING btree (candle_start_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_korea_ohlc_kst_time ON public.korea_ohlc USING btree (candle_start_at_kst DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_korea_ohlc_market_kst ON public.korea_ohlc USING btree (market, candle_start_at_kst DESC) TABLESPACE pg_default;

-- updated_at 자동 갱신 (btc_ohlc와 동일 패턴)
CREATE OR REPLACE FUNCTION public.korea_ohlc_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := (now() AT TIME ZONE 'Asia/Seoul'::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER korea_ohlc_updated_at
  BEFORE UPDATE ON public.korea_ohlc
  FOR EACH ROW
  EXECUTE FUNCTION public.korea_ohlc_set_updated_at();

COMMENT ON TABLE public.korea_ohlc IS '국내 지수 OHLC. Yahoo Finance(^KS11, ^KQ11) 수집. kospi_1d, kospi_4h, kosdaq_1d, kosdaq_4h 등';
COMMENT ON COLUMN public.korea_ohlc.market IS '시장 코드. 예: kospi_1d, kospi_4h, kosdaq_1d, kosdaq_4h';
COMMENT ON COLUMN public.korea_ohlc.candle_start_at IS '캔들 시작 시각 (UTC). 정산·폴 매칭 키';
COMMENT ON COLUMN public.korea_ohlc.candle_start_at_kst IS '캔들 시작 시각 KST (표시/검증용)';
COMMENT ON COLUMN public.korea_ohlc.open IS '시가 = reference_close(목표가)';
COMMENT ON COLUMN public.korea_ohlc.close IS '종가 = settlement_close(정산가)';

ALTER TABLE public.korea_ohlc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access" ON public.korea_ohlc
  FOR ALL
  USING (false);
