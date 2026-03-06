-- =============================================
-- 4시간봉 수정 완료 검증
-- =============================================

-- 1. 수정 후 시간 패턴 확인 (모두 정상이어야 함)
SELECT 
    EXTRACT(HOUR FROM candle_start_at) as "UTC시간",
    COUNT(*) as "개수",
    MIN(candle_start_at) as "최초캔들",
    MAX(candle_start_at) as "최신캔들",
    CASE 
        WHEN EXTRACT(HOUR FROM candle_start_at) IN (0,4,8,12,16,20) THEN '✅ 정상'
        ELSE '🚨 여전히비정상'
    END as "상태"
FROM btc_ohlc 
WHERE market = 'btc_4h'
GROUP BY EXTRACT(HOUR FROM candle_start_at)
ORDER BY "UTC시간";

-- 2. 연속성 검증 (완벽일치 확인)
WITH consistency_check AS (
    SELECT 
        candle_start_at,
        open,
        close,
        LAG(close) OVER (ORDER BY candle_start_at) as prev_close
    FROM btc_ohlc 
    WHERE market = 'btc_4h'
    ORDER BY candle_start_at DESC
    LIMIT 10
)
SELECT 
    candle_start_at as "UTC시간",
    EXTRACT(HOUR FROM candle_start_at) as "UTC_시간",
    prev_close as "이전봉종가",
    open as "현재봉시가",
    ABS(COALESCE(prev_close, 0) - open) as "차이",
    CASE 
        WHEN prev_close IS NULL THEN '🔸 첫번째'
        WHEN ABS(prev_close - open) = 0 THEN '✅ 완벽일치'
        WHEN ABS(prev_close - open) < 0.01 THEN '🟢 거의일치' 
        ELSE '🔴 불일치'
    END as "연속성상태"
FROM consistency_check
ORDER BY candle_start_at DESC;

-- 3. 최신 상태 확인
SELECT 
    market as "시장",
    MAX(candle_start_at) as "최신캔들_UTC",
    EXTRACT(HOUR FROM MAX(candle_start_at)) as "최신캔들_UTC시간",
    MAX(candle_start_at_kst) as "최신캔들_KST",
    COUNT(*) as "총캔들수"
FROM btc_ohlc 
WHERE market = 'btc_4h'
GROUP BY market;