-- =============================================
-- 4시간봉 21:00 문제 디버깅
-- =============================================

-- 1. 최근 수집된 4시간봉 데이터 확인 (시간순 정렬)
SELECT 
    market,
    candle_start_at as "UTC시간",
    EXTRACT(HOUR FROM candle_start_at) as "UTC_시간",
    candle_start_at_kst as "KST시간", 
    open,
    close,
    created_at as "수집시각",
    updated_at as "업데이트시각",
    CASE 
        WHEN updated_at > NOW() - INTERVAL '30 minutes' THEN '🆕 방금수집'
        WHEN updated_at > NOW() - INTERVAL '2 hours' THEN '🕐 최근수집'
        ELSE '📅 기존데이터'
    END as "수집타입"
FROM btc_ohlc 
WHERE market = 'btc_4h'
ORDER BY candle_start_at DESC 
LIMIT 10;

-- 2. 4시간봉 시간 패턴 분석 (정상: 0,4,8,12,16,20)
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

-- 3. 방금 curl로 수집한 4시간봉이 정말 UTC 기준인지 확인
SELECT 
    candle_start_at as "UTC시간",
    EXTRACT(HOUR FROM candle_start_at) as "UTC_시간",
    candle_start_at_kst as "KST시간",
    EXTRACT(HOUR FROM candle_start_at_kst::timestamp) as "KST_시간",
    open,
    close,
    updated_at as "업데이트시각"
FROM btc_ohlc 
WHERE market = 'btc_4h'
    AND updated_at > NOW() - INTERVAL '30 minutes'  -- 최근 30분 내 업데이트
ORDER BY candle_start_at DESC;

-- 4. 현재 시각 기준으로 다음 4시간봉이 언제여야 하는지 계산
WITH time_info AS (
    SELECT 
        NOW() as utc_now,
        EXTRACT(HOUR FROM NOW()) as current_utc_hour
),
next_4h_slot AS (
    SELECT 
        utc_now,
        current_utc_hour,
        CASE 
            WHEN current_utc_hour < 4 THEN 4
            WHEN current_utc_hour < 8 THEN 8  
            WHEN current_utc_hour < 12 THEN 12
            WHEN current_utc_hour < 16 THEN 16
            WHEN current_utc_hour < 20 THEN 20
            ELSE 24  -- 다음날 0시
        END as next_4h_hour
    FROM time_info
)
SELECT 
    utc_now as "현재_UTC",
    current_utc_hour as "현재_UTC_시간",
    next_4h_hour as "다음_4h봉_시간",
    CASE 
        WHEN next_4h_hour = 24 THEN 
            DATE_TRUNC('day', utc_now) + INTERVAL '1 day'
        ELSE 
            DATE_TRUNC('day', utc_now) + (next_4h_hour || ' hours')::interval
    END as "다음_4h봉_정확한_시각"
FROM next_4h_slot;