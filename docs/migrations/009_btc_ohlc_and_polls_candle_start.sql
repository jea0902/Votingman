-- =============================================
-- 009: btc_ohlc 테이블 신설 + sentiment_polls candle_start_at 확장
--
-- 목적:
-- - 가격 데이터를 btc_ohlc로 분리하여 수집·조회 독립화
-- - sentiment_polls에서 (market, candle_start_at)으로 4h/1h/15m 등 시간봉 구분
-- - market: btc_1d, btc_4h, btc_1h, btc_15m (투표) + btc_1W, btc_1M, btc_12M (수집용)
--
-- 실행 전: 008(price_open/close/change_pct) 적용 상태 가정
-- 기존 데이터: market='btc' → 'btc_1d', candle_start_at = poll_date 00:00 KST
-- =============================================

-- =============================================
-- 1. btc_ohlc 테이블 생성
-- =============================================

CREATE TABLE IF NOT EXISTS public.btc_ohlc (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    market TEXT NOT NULL,
    candle_start_at TIMESTAMPTZ NOT NULL,
    open NUMERIC(20, 2) NOT NULL,
    close NUMERIC(20, 2) NOT NULL,
    high NUMERIC(20, 2),
    low NUMERIC(20, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT btc_ohlc_pkey PRIMARY KEY (id),
    CONSTRAINT btc_ohlc_market_start_unique UNIQUE (market, candle_start_at)
);

COMMENT ON TABLE public.btc_ohlc IS '비트코인 OHLC 캔들 데이터. market: btc_1d, btc_4h, btc_1h, btc_15m, btc_1W, btc_1M, btc_12M 등';
COMMENT ON COLUMN public.btc_ohlc.market IS '봉 구간: btc_1d(일), btc_4h(4시간), btc_1h(1시간), btc_15m(15분), btc_1W(주), btc_1M(월), btc_12M(12개월)';
COMMENT ON COLUMN public.btc_ohlc.candle_start_at IS '캔들 시작 시각 (Binance openTime, UTC 저장)';
COMMENT ON COLUMN public.btc_ohlc.open IS '시가 (USD)';
COMMENT ON COLUMN public.btc_ohlc.close IS '종가 (USD)';
COMMENT ON COLUMN public.btc_ohlc.high IS '고가 (USD)';
COMMENT ON COLUMN public.btc_ohlc.low IS '저가 (USD)';

CREATE INDEX idx_btc_ohlc_market ON public.btc_ohlc(market);
CREATE INDEX idx_btc_ohlc_market_start ON public.btc_ohlc(market, candle_start_at DESC);
CREATE INDEX idx_btc_ohlc_candle_start ON public.btc_ohlc(candle_start_at DESC);

ALTER TABLE public.btc_ohlc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view btc_ohlc"
    ON public.btc_ohlc FOR SELECT
    USING (true);

-- INSERT/UPDATE는 서버(service_role)만

-- updated_at 트리거
CREATE TRIGGER btc_ohlc_updated_at
    BEFORE UPDATE ON public.btc_ohlc
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();


-- =============================================
-- 2. sentiment_polls 수정
-- =============================================

-- 2.1 candle_start_at 컬럼 추가
ALTER TABLE public.sentiment_polls
    ADD COLUMN IF NOT EXISTS candle_start_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sentiment_polls.candle_start_at IS '캔들 시작 시각. (market, candle_start_at)으로 btc_ohlc와 조인하여 정산';

-- 2.2 기존 데이터 보정: market='btc' → 'btc_1d', candle_start_at = poll_date 00:00 KST
UPDATE public.sentiment_polls
SET
    candle_start_at = COALESCE(
        candle_start_at,
        (poll_date::timestamp AT TIME ZONE 'Asia/Seoul')
    ),
    market = CASE
        WHEN market IS NULL OR market = 'btc' THEN 'btc_1d'
        ELSE market
    END
WHERE candle_start_at IS NULL OR market IS NULL OR market = 'btc';

-- 2.3 candle_start_at NOT NULL 적용 (새 행용)
ALTER TABLE public.sentiment_polls
    ALTER COLUMN candle_start_at SET NOT NULL;

-- 2.4 가격 컬럼 삭제 (008 적용 시 price_*, 미적용 시 btc_*)
ALTER TABLE public.sentiment_polls DROP COLUMN IF EXISTS price_open;
ALTER TABLE public.sentiment_polls DROP COLUMN IF EXISTS price_close;
ALTER TABLE public.sentiment_polls DROP COLUMN IF EXISTS change_pct;
ALTER TABLE public.sentiment_polls DROP COLUMN IF EXISTS btc_open;
ALTER TABLE public.sentiment_polls DROP COLUMN IF EXISTS btc_close;
ALTER TABLE public.sentiment_polls DROP COLUMN IF EXISTS btc_change_pct;

-- 2.5 Unique 제약 변경: (poll_date, market) → (market, candle_start_at)
ALTER TABLE public.sentiment_polls
    DROP CONSTRAINT IF EXISTS sentiment_polls_poll_date_market_unique;

ALTER TABLE public.sentiment_polls
    ADD CONSTRAINT sentiment_polls_market_candle_start_unique UNIQUE (market, candle_start_at);

-- 2.6 poll_date 유지 (조회·인덱스용, candle_start_at의 날짜 부분)
COMMENT ON COLUMN public.sentiment_polls.poll_date IS '캔들 날짜 (KST, candle_start_at 기반). 조회 편의용';
COMMENT ON COLUMN public.sentiment_polls.market IS '시장·봉: btc_1d, btc_4h, btc_1h, btc_15m';

-- 2.7 인덱스 보강
CREATE INDEX IF NOT EXISTS idx_sentiment_polls_market_candle
    ON public.sentiment_polls(market, candle_start_at DESC);

CREATE INDEX IF NOT EXISTS idx_sentiment_polls_settled
    ON public.sentiment_polls(settled_at) WHERE settled_at IS NULL;


-- =============================================
-- 3. 실행 후 확인
-- =============================================
-- SELECT * FROM public.btc_ohlc ORDER BY market, candle_start_at DESC LIMIT 20;
-- SELECT id, poll_date, market, candle_start_at, settled_at FROM public.sentiment_polls ORDER BY market, candle_start_at DESC LIMIT 20;
