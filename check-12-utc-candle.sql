-- =============================================
-- UTC 12시 캔들 정체 확인
-- =============================================

-- UTC 12시 캔들이 언제 수집되었는지 확인
SELECT 
    candle_start_at as "UTC시간",
    EXTRACT(HOUR FROM candle_start_at) as "UTC_시간",
    candle_start_at_kst as "KST시간",
    open,
    close,
    created_at as "수집시각_KST",
    updated_at as "업데이트시각_KST",
    CASE 
        WHEN updated_at > NOW() - INTERVAL '1 hour' THEN '🆕 최근1시간'
        WHEN updated_at > NOW() - INTERVAL '6 hours' THEN '🕕 최근6시간'
        ELSE '📅 오래된데이터'
    END as "수집시기"
FROM btc_ohlc 
WHERE market = 'btc_4h'
    AND EXTRACT(HOUR FROM candle_start_at) = 12
ORDER BY candle_start_at DESC;