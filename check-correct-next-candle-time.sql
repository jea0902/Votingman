-- =============================================
-- 정확한 다음 캔들 시간 계산
-- =============================================

-- 1. 현재 상황 정확히 파악
SELECT 
    NOW() as "현재_UTC_시간",
    NOW() AT TIME ZONE 'Asia/Seoul' as "현재_KST_시간",
    EXTRACT(EPOCH FROM NOW()) as "현재_타임스탬프";

-- 2. 각 시장별 마지막 캔들과 현재 시간 비교
SELECT 
    market,
    MAX(candle_start_at) as "마지막_캔들_UTC",
    MAX(candle_start_at_kst) as "마지막_캔들_KST",
    NOW() as "현재_UTC",
    (NOW() - MAX(candle_start_at)) as "마지막캔들로부터_경과시간"
FROM btc_ohlc 
WHERE market IN ('btc_15m', 'btc_1h', 'btc_4h', 'btc_1d')
GROUP BY market
ORDER BY market;

-- 3. 정확한 다음 캔들 시간 계산 (현재 시간 기준)
WITH current_time_info AS (
    SELECT NOW() as now_utc
),
next_candle_calc AS (
    SELECT 
        'btc_15m' as market,
        '15분' as interval_name,
        -- 현재 시간을 15분 단위로 올림
        DATE_TRUNC('hour', (SELECT now_utc FROM current_time_info)) + 
        (CEIL(EXTRACT(MINUTE FROM (SELECT now_utc FROM current_time_info)) / 15.0) * INTERVAL '15 minutes') as next_candle_utc
    UNION ALL
    SELECT 
        'btc_1h' as market,
        '1시간' as interval_name,
        -- 현재 시간을 1시간 단위로 올림
        DATE_TRUNC('hour', (SELECT now_utc FROM current_time_info)) + INTERVAL '1 hour' as next_candle_utc
    UNION ALL
    SELECT 
        'btc_4h' as market,
        '4시간' as interval_name,
        -- 현재 시간을 4시간 단위로 올림 (UTC 00:00 기준)
        DATE_TRUNC('day', (SELECT now_utc FROM current_time_info)) + 
        (CEIL(EXTRACT(HOUR FROM (SELECT now_utc FROM current_time_info)) / 4.0) * INTERVAL '4 hours') as next_candle_utc
    UNION ALL
    SELECT 
        'btc_1d' as market,
        '1일' as interval_name,
        -- 현재 시간을 1일 단위로 올림 (UTC 00:00 기준)
        DATE_TRUNC('day', (SELECT now_utc FROM current_time_info)) + INTERVAL '1 day' as next_candle_utc
)
SELECT 
    market,
    interval_name,
    next_candle_utc as "다음_캔들_UTC",
    next_candle_utc AT TIME ZONE 'Asia/Seoul' as "다음_캔들_KST",
    (next_candle_utc - (SELECT now_utc FROM current_time_info)) as "남은_시간",
    CASE 
        WHEN (next_candle_utc - (SELECT now_utc FROM current_time_info)) > INTERVAL '0' THEN '⏳대기중'
        ELSE '🔴이미지남'
    END as "상태"
FROM next_candle_calc
ORDER BY market;

-- 4. 크론 실행 상태 추정
WITH cron_status AS (
    SELECT 
        market,
        MAX(candle_start_at) as last_candle,
        NOW() as current_time,
        CASE 
            WHEN market = 'btc_15m' THEN 
                FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(candle_start_at))) / 900) -- 15분 = 900초
            WHEN market = 'btc_1h' THEN 
                FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(candle_start_at))) / 3600) -- 1시간 = 3600초
            WHEN market = 'btc_4h' THEN 
                FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(candle_start_at))) / 14400) -- 4시간 = 14400초
            WHEN market = 'btc_1d' THEN 
                FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(candle_start_at))) / 86400) -- 1일 = 86400초
            ELSE 0
        END as missed_candles
    FROM btc_ohlc 
    WHERE market IN ('btc_15m', 'btc_1h', 'btc_4h', 'btc_1d')
    GROUP BY market
)
SELECT 
    market,
    last_candle as "마지막_수집_UTC",
    current_time as "현재_UTC",
    missed_candles as "누락된_캔들수",
    CASE 
        WHEN missed_candles = 0 THEN '✅최신상태'
        WHEN missed_candles <= 2 THEN '🟡약간지연'
        ELSE '🔴심각한지연'
    END as "크론상태"
FROM cron_status
ORDER BY market;