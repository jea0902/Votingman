-- =============================================
-- 4시간봉 데이터만 확인 (개별 실행용)
-- =============================================

-- 쿼리 1: 최근 4시간봉 데이터 확인
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