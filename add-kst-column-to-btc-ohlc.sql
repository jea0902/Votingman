-- =============================================
-- btc_ohlc 테이블에 KST 컬럼 추가
-- =============================================

-- 1. candle_start_at_kst 컬럼 추가 (UTC -> KST 변환용)
ALTER TABLE public.btc_ohlc 
ADD COLUMN candle_start_at_kst timestamp without time zone;

-- 2. 기존 데이터에 KST 값 채우기
UPDATE public.btc_ohlc 
SET candle_start_at_kst = (candle_start_at AT TIME ZONE 'Asia/Seoul')::timestamp;

-- 3. 인덱스 추가 (검색 성능용)
CREATE INDEX IF NOT EXISTS idx_btc_ohlc_kst_time 
ON public.btc_ohlc (candle_start_at_kst DESC);

-- 4. 복합 인덱스 추가 (market + KST 시간)
CREATE INDEX IF NOT EXISTS idx_btc_ohlc_market_kst 
ON public.btc_ohlc (market, candle_start_at_kst DESC);

-- 5. 확인 쿼리 - KST 컬럼이 제대로 추가되었는지 확인
SELECT 
    market,
    candle_start_at as "UTC시간",
    candle_start_at_kst as "KST시간",
    open,
    close,
    created_at
FROM btc_ohlc 
WHERE market = 'btc_4h'
ORDER BY candle_start_at DESC 
LIMIT 5;

-- 6. KST 시간대별 분포 확인 (4시간봉이 제대로 UTC 기준인지)
SELECT 
    market,
    EXTRACT(HOUR FROM candle_start_at) as utc_hour,
    EXTRACT(HOUR FROM candle_start_at_kst) as kst_hour,
    COUNT(*) as count
FROM btc_ohlc 
WHERE market = 'btc_4h'
GROUP BY market, utc_hour, kst_hour
ORDER BY count DESC;