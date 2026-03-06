-- =============================================
-- 방금 수집된 4시간봉만 확인
-- =============================================

-- 쿼리 3: 방금 curl로 수집한 4시간봉이 정말 UTC 기준인지 확인
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