-- =============================================
-- 무엇이 일어났는지 긴급 확인
-- =============================================

-- 1. 전체 4시간봉 데이터 개수 확인
SELECT 
    COUNT(*) as "전체_4시간봉_개수",
    MIN(candle_start_at) as "가장_오래된_캔들",
    MAX(candle_start_at) as "가장_최신_캔들"
FROM btc_ohlc 
WHERE market = 'btc_4h';

-- 2. 최근 24시간 내 삭제된 기록이 있는지 확인 (updated_at 패턴)
SELECT 
    DATE_TRUNC('hour', updated_at) as "업데이트_시간대",
    COUNT(*) as "개수"
FROM btc_ohlc 
WHERE market = 'btc_4h'
    AND updated_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', updated_at)
ORDER BY "업데이트_시간대" DESC;

-- 3. 다른 시장들도 비슷하게 데이터가 적은지 확인
SELECT 
    market,
    COUNT(*) as "총개수",
    MAX(candle_start_at) as "최신캔들"
FROM btc_ohlc 
WHERE market IN ('btc_15m', 'btc_1h', 'btc_4h', 'btc_1d')
GROUP BY market
ORDER BY market;

-- 4. 혹시 다른 테이블이나 스키마를 보고 있는건 아닌지 확인
SELECT 
    schemaname,
    tablename,
    rowcount
FROM (
    SELECT 
        schemaname,
        tablename,
        n_tup_ins - n_tup_del as rowcount
    FROM pg_stat_user_tables 
    WHERE tablename LIKE '%btc%' OR tablename LIKE '%ohlc%'
) t
ORDER BY rowcount DESC;