-- =============================================
-- 데이터 구조 및 비즈니스 로직 확인
-- =============================================

-- 1. candle_start_at이 UTC인지 확인 (4시간봉)
SELECT 
    market,
    candle_start_at,
    EXTRACT(HOUR FROM candle_start_at) as start_hour_utc,
    open,
    close,
    created_at
FROM btc_ohlc 
WHERE market = 'btc_4h'
ORDER BY candle_start_at DESC 
LIMIT 10;

-- 2. 4시간봉 시간 패턴 확인 (UTC 기준이면 0,4,8,12,16,20이어야 함)
SELECT 
    EXTRACT(HOUR FROM candle_start_at) as utc_hour,
    COUNT(*) as count
FROM btc_ohlc 
WHERE market = 'btc_4h'
GROUP BY EXTRACT(HOUR FROM candle_start_at)
ORDER BY utc_hour;

-- 3. 1일봉도 확인 (UTC 기준이면 0시여야 함)
SELECT 
    EXTRACT(HOUR FROM candle_start_at) as utc_hour,
    COUNT(*) as count
FROM btc_ohlc 
WHERE market = 'btc_1d'
GROUP BY EXTRACT(HOUR FROM candle_start_at)
ORDER BY utc_hour;

-- 4. payout_history의 settled_at 확인 (KST인지)
SELECT 
    settled_at,
    settled_at AT TIME ZONE 'UTC' as utc_time,
    settled_at AT TIME ZONE 'Asia/Seoul' as kst_time,
    market,
    bet_amount,
    payout_amount
FROM payout_history 
ORDER BY settled_at DESC 
LIMIT 5;

-- 5. 연속된 두 캔들로 시가/종가 관계 확인 (4시간봉 예시)
WITH consecutive_candles AS (
    SELECT 
        candle_start_at,
        open,
        close,
        LAG(close) OVER (ORDER BY candle_start_at) as prev_close
    FROM btc_ohlc 
    WHERE market = 'btc_4h'
    ORDER BY candle_start_at DESC
    LIMIT 5
)
SELECT 
    candle_start_at,
    prev_close as "이전봉_종가(목표가)",
    open as "현재봉_시가",
    close as "현재봉_종가",
    CASE 
        WHEN prev_close IS NULL THEN 'N/A'
        WHEN prev_close = open THEN '✅ 일치' 
        ELSE '❌ 불일치'
    END as "시가_목표가_일치성"
FROM consecutive_candles
ORDER BY candle_start_at DESC;