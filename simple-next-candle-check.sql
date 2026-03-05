-- =============================================
-- 간단하고 명확한 다음 캔들 시간 확인
-- =============================================

WITH current_info AS (
    SELECT NOW() as now_utc
),
last_candle_info AS (
    SELECT 
        market,
        MAX(candle_start_at) as last_candle_utc,
        MAX(candle_start_at_kst) as last_candle_kst
    FROM btc_ohlc 
    WHERE market IN ('btc_15m', 'btc_1h', 'btc_4h', 'btc_1d')
    GROUP BY market
),
next_candle_calc AS (
    SELECT 
        l.market,
        l.last_candle_utc,
        l.last_candle_kst,
        c.now_utc as current_utc,
        c.now_utc AT TIME ZONE 'Asia/Seoul' as current_kst,
        
        -- 다음 캔들 시간 계산
        CASE 
            WHEN l.market = 'btc_15m' THEN 
                DATE_TRUNC('hour', c.now_utc) + 
                (CEIL(EXTRACT(MINUTE FROM c.now_utc) / 15.0) * INTERVAL '15 minutes')
            WHEN l.market = 'btc_1h' THEN 
                DATE_TRUNC('hour', c.now_utc) + INTERVAL '1 hour'
            WHEN l.market = 'btc_4h' THEN 
                DATE_TRUNC('day', c.now_utc) + 
                (CEIL(EXTRACT(HOUR FROM c.now_utc) / 4.0) * INTERVAL '4 hours')
            WHEN l.market = 'btc_1d' THEN 
                DATE_TRUNC('day', c.now_utc) + INTERVAL '1 day'
            ELSE NULL
        END as next_candle_utc,
        
        -- 누락된 캔들 수 계산
        CASE 
            WHEN l.market = 'btc_15m' THEN 
                FLOOR(EXTRACT(EPOCH FROM (c.now_utc - l.last_candle_utc)) / 900)
            WHEN l.market = 'btc_1h' THEN 
                FLOOR(EXTRACT(EPOCH FROM (c.now_utc - l.last_candle_utc)) / 3600)
            WHEN l.market = 'btc_4h' THEN 
                FLOOR(EXTRACT(EPOCH FROM (c.now_utc - l.last_candle_utc)) / 14400)
            WHEN l.market = 'btc_1d' THEN 
                FLOOR(EXTRACT(EPOCH FROM (c.now_utc - l.last_candle_utc)) / 86400)
            ELSE 0
        END as missed_candles
        
    FROM last_candle_info l
    CROSS JOIN current_info c
)
SELECT 
    market as "시장",
    last_candle_kst as "마지막_캔들_KST",
    current_kst as "현재_시간_KST",
    next_candle_utc as "다음_캔들_UTC", 
    next_candle_utc AT TIME ZONE 'Asia/Seoul' as "다음_캔들_KST",
    (next_candle_utc - current_utc) as "남은_시간",
    missed_candles as "누락된_캔들수",
    CASE 
        WHEN missed_candles = 0 THEN '✅최신상태'
        WHEN missed_candles <= 2 THEN '🟡약간지연'
        ELSE '🔴심각한지연'
    END as "크론상태"
FROM next_candle_calc
ORDER BY market;