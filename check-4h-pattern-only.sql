-- =============================================
-- 4시간봉 시간 패턴 분석만
-- =============================================

-- 쿼리 2: 4시간봉 시간 패턴 분석 (정상: 0,4,8,12,16,20)
SELECT 
    EXTRACT(HOUR FROM candle_start_at) as "UTC시간",
    COUNT(*) as "개수",
    MIN(candle_start_at) as "최초발견",
    MAX(candle_start_at) as "최근발견",
    CASE 
        WHEN EXTRACT(HOUR FROM candle_start_at) IN (0,4,8,12,16,20) THEN '✅ 정상'
        ELSE '🚨 비정상'
    END as "상태"
FROM btc_ohlc 
WHERE market = 'btc_4h'
GROUP BY EXTRACT(HOUR FROM candle_start_at)
ORDER BY "UTC시간";