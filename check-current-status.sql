-- =============================================
-- 현재 상태 확인 (즉시 실행 가능)
-- =============================================

-- 1. KST 컬럼이 제대로 추가되었는지 확인
SELECT 
    market,
    candle_start_at as "UTC시간",
    candle_start_at_kst as "KST시간(기존데이터)",
    open,
    close,
    created_at as "DB저장시각",
    updated_at as "DB수정시각"
FROM btc_ohlc 
WHERE market = 'btc_4h'
ORDER BY candle_start_at DESC 
LIMIT 5;

-- 2. 기존 데이터의 불일치 현황 (예상: 여전히 불일치)
WITH old_data_consistency AS (
    SELECT 
        market,
        candle_start_at_kst,
        open,
        close,
        LAG(close) OVER (PARTITION BY market ORDER BY candle_start_at) as prev_close
    FROM btc_ohlc 
    WHERE market = 'btc_4h'
    ORDER BY candle_start_at DESC
    LIMIT 10
)
SELECT 
    market,
    candle_start_at_kst as "KST시간",
    prev_close as "이전봉종가",
    open as "현재봉시가", 
    ABS(COALESCE(prev_close, 0) - open) as "차이",
    CASE 
        WHEN prev_close IS NULL THEN '첫번째캔들'
        WHEN ABS(prev_close - open) = 0 THEN '✅완벽일치' 
        WHEN ABS(prev_close - open) < 0.05 THEN '🟡미세차이'
        ELSE '🔴큰차이'
    END as "상태"
FROM old_data_consistency
ORDER BY candle_start_at_kst DESC;

-- 3. 다음 크론 실행 예상 시간 확인
SELECT 
    market,
    MAX(candle_start_at) as "마지막_캔들_UTC",
    MAX(candle_start_at_kst) as "마지막_캔들_KST",
    CASE 
        WHEN market = 'btc_15m' THEN 
            MAX(candle_start_at) + INTERVAL '15 minutes'
        WHEN market = 'btc_1h' THEN 
            MAX(candle_start_at) + INTERVAL '1 hour'
        WHEN market = 'btc_4h' THEN 
            MAX(candle_start_at) + INTERVAL '4 hours'
        WHEN market = 'btc_1d' THEN 
            MAX(candle_start_at) + INTERVAL '1 day'
        ELSE NULL
    END as "다음_캔들_예상_UTC",
    NOW() as "현재시간_UTC"
FROM btc_ohlc 
WHERE market IN ('btc_15m', 'btc_1h', 'btc_4h', 'btc_1d')
GROUP BY market
ORDER BY market;