-- =============================================
-- 캔들 데이터 불일치 원인 분석
-- =============================================

-- 1. 4시간봉 연속 캔들 상세 분석 (시간 순서와 함께)
WITH detailed_candles AS (
    SELECT 
        candle_start_at,
        open,
        close,
        high,
        low,
        created_at,
        updated_at,
        LAG(close) OVER (ORDER BY candle_start_at) as prev_close,
        LAG(candle_start_at) OVER (ORDER BY candle_start_at) as prev_candle_start
    FROM btc_ohlc 
    WHERE market = 'btc_4h'
    ORDER BY candle_start_at DESC
    LIMIT 10
)
SELECT 
    candle_start_at,
    prev_candle_start,
    prev_close as "이전봉_종가",
    open as "현재봉_시가",
    ABS(prev_close - open) as "차이_절댓값",
    close as "현재봉_종가",
    CASE 
        WHEN prev_close IS NULL THEN 'N/A'
        WHEN ABS(prev_close - open) < 0.005 THEN '✅ 거의일치' 
        WHEN ABS(prev_close - open) < 0.05 THEN '⚠️ 미세차이'
        ELSE '❌ 큰차이'
    END as "일치성평가",
    created_at as "DB저장시각_KST",
    updated_at as "DB수정시각_KST"
FROM detailed_candles
ORDER BY candle_start_at DESC;

-- 2. 같은 시점 다른 시장 비교 (1시간봉과 비교)
SELECT 
    '4h' as market_type,
    candle_start_at,
    open,
    close
FROM btc_ohlc 
WHERE market = 'btc_4h' 
    AND candle_start_at >= '2026-03-04 20:00:00+00'
UNION ALL
SELECT 
    '1h' as market_type,
    candle_start_at,
    open,
    close
FROM btc_ohlc 
WHERE market = 'btc_1h' 
    AND candle_start_at >= '2026-03-04 20:00:00+00'
ORDER BY candle_start_at DESC, market_type;

-- 3. 바이낸스 API 호출 시점 확인 (created_at 패턴)
SELECT 
    market,
    candle_start_at,
    created_at,
    updated_at,
    EXTRACT(MINUTE FROM created_at AT TIME ZONE 'Asia/Seoul') as "수집분_KST",
    EXTRACT(SECOND FROM created_at AT TIME ZONE 'Asia/Seoul') as "수집초_KST"
FROM btc_ohlc 
WHERE market IN ('btc_4h', 'btc_1h')
    AND candle_start_at >= '2026-03-04 20:00:00+00'
ORDER BY market, candle_start_at DESC;

-- 4. 차이가 큰 케이스들만 필터링
WITH mismatch_analysis AS (
    SELECT 
        candle_start_at,
        open,
        close,
        LAG(close) OVER (ORDER BY candle_start_at) as prev_close,
        ABS(LAG(close) OVER (ORDER BY candle_start_at) - open) as diff
    FROM btc_ohlc 
    WHERE market = 'btc_4h'
)
SELECT 
    candle_start_at,
    prev_close,
    open,
    diff as "차이",
    CASE 
        WHEN diff > 1 THEN '🔴 심각한차이'
        WHEN diff > 0.1 THEN '🟡 주의필요'
        WHEN diff > 0.01 THEN '🟢 미세차이'
        ELSE '✅ 정상'
    END as "심각도"
FROM mismatch_analysis 
WHERE diff IS NOT NULL 
    AND diff > 0.005  -- 0.005 이상 차이나는 것만
ORDER BY diff DESC;