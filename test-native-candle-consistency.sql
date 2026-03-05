-- =============================================
-- 네이티브 캔들 연속성 테스트
-- (변경 후 실행 - 새로 수집된 데이터)
-- =============================================

-- 1. 새로 수집될 데이터 구조 확인 (KST 컬럼 포함)
SELECT 
    market,
    candle_start_at as "UTC시간",
    candle_start_at_kst as "KST시간", 
    open,
    close,
    created_at
FROM btc_ohlc 
WHERE market = 'btc_4h'
    AND candle_start_at_kst IS NOT NULL  -- 새로 추가된 컬럼
ORDER BY candle_start_at DESC 
LIMIT 5;

-- 2. 연속성 검증 (네이티브 캔들의 경우 완벽해야 함)
WITH consecutive_analysis AS (
    SELECT 
        market,
        candle_start_at,
        candle_start_at_kst,
        open,
        close,
        LAG(close) OVER (PARTITION BY market ORDER BY candle_start_at) as prev_close,
        LAG(candle_start_at) OVER (PARTITION BY market ORDER BY candle_start_at) as prev_candle_start
    FROM btc_ohlc 
    WHERE market IN ('btc_4h', 'btc_1d', 'btc_1h', 'btc_15m')
        AND candle_start_at_kst IS NOT NULL  -- 새로 수집된 데이터만
    ORDER BY market, candle_start_at DESC
)
SELECT 
    market,
    candle_start_at_kst as "KST시간",
    prev_close as "이전봉_종가",
    open as "현재봉_시가",
    ABS(COALESCE(prev_close, 0) - open) as "차이_절댓값",
    CASE 
        WHEN prev_close IS NULL THEN '✅ 첫번째_캔들'
        WHEN ABS(prev_close - open) = 0 THEN '✅ 완벽일치' 
        WHEN ABS(prev_close - open) < 0.01 THEN '🟢 미세차이'
        WHEN ABS(prev_close - open) < 0.1 THEN '🟡 주의필요'
        ELSE '🔴 문제발생'
    END as "연속성_상태"
FROM consecutive_analysis
WHERE market = 'btc_4h'  -- 4시간봉부터 테스트
ORDER BY candle_start_at DESC
LIMIT 10;

-- 3. 모든 시간봉 연속성 요약 통계
WITH consistency_stats AS (
    SELECT 
        market,
        candle_start_at,
        open,
        close,
        LAG(close) OVER (PARTITION BY market ORDER BY candle_start_at) as prev_close
    FROM btc_ohlc 
    WHERE candle_start_at_kst IS NOT NULL  -- 새로 수집된 데이터만
)
SELECT 
    market,
    COUNT(*) as "총_캔들수",
    COUNT(CASE WHEN prev_close IS NOT NULL AND ABS(prev_close - open) = 0 THEN 1 END) as "완벽일치",
    COUNT(CASE WHEN prev_close IS NOT NULL AND ABS(prev_close - open) BETWEEN 0.01 AND 0.1 THEN 1 END) as "미세차이",
    COUNT(CASE WHEN prev_close IS NOT NULL AND ABS(prev_close - open) > 0.1 THEN 1 END) as "큰차이",
    ROUND(
        COUNT(CASE WHEN prev_close IS NOT NULL AND ABS(prev_close - open) = 0 THEN 1 END) * 100.0 / 
        NULLIF(COUNT(CASE WHEN prev_close IS NOT NULL THEN 1 END), 0), 2
    ) as "일치율_퍼센트"
FROM consistency_stats 
GROUP BY market
ORDER BY market;

-- 4. 시간 패턴 검증 (UTC vs KST)
SELECT 
    market,
    EXTRACT(HOUR FROM candle_start_at) as utc_hour,
    EXTRACT(HOUR FROM candle_start_at_kst::timestamp) as kst_hour,
    COUNT(*) as count
FROM btc_ohlc 
WHERE candle_start_at_kst IS NOT NULL
    AND market = 'btc_4h'
GROUP BY market, utc_hour, kst_hour
ORDER BY count DESC;

-- 5. 1일봉 패턴 검증 (UTC 00:00이어야 함)
SELECT 
    market,
    EXTRACT(HOUR FROM candle_start_at) as utc_hour,
    EXTRACT(HOUR FROM candle_start_at_kst::timestamp) as kst_hour,
    COUNT(*) as count
FROM btc_ohlc 
WHERE candle_start_at_kst IS NOT NULL
    AND market = 'btc_1d'
GROUP BY market, utc_hour, kst_hour
ORDER BY count DESC;