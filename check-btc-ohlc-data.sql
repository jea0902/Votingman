-- =============================================
-- btc_ohlc 데이터 시간 기준 확인
-- =============================================

-- 1. 각 시간봉별 최근 데이터 샘플 확인
SELECT 
    market,
    candle_start_at,
    candle_start_at AT TIME ZONE 'UTC' as utc_time,
    candle_start_at AT TIME ZONE 'Asia/Seoul' as kst_time,
    open,
    close,
    created_at
FROM btc_ohlc 
WHERE market = 'btc_1d'
ORDER BY candle_start_at DESC 
LIMIT 5;

SELECT 
    market,
    candle_start_at,
    candle_start_at AT TIME ZONE 'UTC' as utc_time,
    candle_start_at AT TIME ZONE 'Asia/Seoul' as kst_time,
    open,
    close,
    created_at
FROM btc_ohlc 
WHERE market = 'btc_4h'
ORDER BY candle_start_at DESC 
LIMIT 10;

SELECT 
    market,
    candle_start_at,
    candle_start_at AT TIME ZONE 'UTC' as utc_time,
    candle_start_at AT TIME ZONE 'Asia/Seoul' as kst_time,
    open,
    close,
    created_at
FROM btc_ohlc 
WHERE market = 'btc_1h'
ORDER BY candle_start_at DESC 
LIMIT 10;

SELECT 
    market,
    candle_start_at,
    candle_start_at AT TIME ZONE 'UTC' as utc_time,
    candle_start_at AT TIME ZONE 'Asia/Seoul' as kst_time,
    open,
    close,
    created_at
FROM btc_ohlc 
WHERE market = 'btc_15m'
ORDER BY candle_start_at DESC 
LIMIT 10;

-- 2. 시간 패턴 분석
-- 1일봉: UTC 00:00이면 올바른 기준
SELECT 
    market,
    EXTRACT(HOUR FROM candle_start_at AT TIME ZONE 'UTC') as utc_hour,
    EXTRACT(HOUR FROM candle_start_at AT TIME ZONE 'Asia/Seoul') as kst_hour,
    COUNT(*) as count
FROM btc_ohlc 
WHERE market = 'btc_1d'
GROUP BY market, utc_hour, kst_hour
ORDER BY count DESC;

-- 4시간봉: UTC 기준이면 0,4,8,12,16,20 / KST 기준이면 15,19,23,3,7,11 (UTC 시간대)
SELECT 
    market,
    EXTRACT(HOUR FROM candle_start_at AT TIME ZONE 'UTC') as utc_hour,
    EXTRACT(HOUR FROM candle_start_at AT TIME ZONE 'Asia/Seoul') as kst_hour,
    COUNT(*) as count
FROM btc_ohlc 
WHERE market = 'btc_4h'
GROUP BY market, utc_hour, kst_hour
ORDER BY count DESC;

-- 1시간봉: KST 기준이면 UTC 시간은 15,16,17...14 패턴
SELECT 
    market,
    EXTRACT(HOUR FROM candle_start_at AT TIME ZONE 'UTC') as utc_hour,
    COUNT(*) as count
FROM btc_ohlc 
WHERE market = 'btc_1h'
GROUP BY market, utc_hour
ORDER BY utc_hour;

-- 15분봉: KST 기준이면 UTC 시간은 15,16,17...14 패턴, 분은 0,15,30,45
SELECT 
    market,
    EXTRACT(HOUR FROM candle_start_at AT TIME ZONE 'UTC') as utc_hour,
    EXTRACT(MINUTE FROM candle_start_at AT TIME ZONE 'UTC') as utc_minute,
    COUNT(*) as count
FROM btc_ohlc 
WHERE market = 'btc_15m'
GROUP BY market, utc_hour, utc_minute
ORDER BY utc_hour, utc_minute;