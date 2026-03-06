-- =============================================
-- curl 실행 여부 확인
-- =============================================

-- 1. 같은 시각에 다른 시장도 수집되었는지 확인 (curl이면 3개 모두 동시 수집)
SELECT 
    market,
    MAX(candle_start_at) as "최신캔들_UTC",
    MAX(updated_at) as "업데이트시각_KST",
    CASE 
        WHEN MAX(updated_at) > '2026-03-06 02:35:00'::timestamp 
         AND MAX(updated_at) < '2026-03-06 02:40:00'::timestamp 
        THEN '🎯 curl실행시간대'
        ELSE '❌ 다른시간대'
    END as "curl여부추정"
FROM btc_ohlc 
WHERE market IN ('btc_15m', 'btc_1h', 'btc_4h')
GROUP BY market
ORDER BY market;

-- 2. 4시간봉 12시 UTC가 이전에도 있었는지 확인
SELECT 
    candle_start_at as "UTC시간",
    created_at as "생성시각_KST",
    updated_at as "업데이트시각_KST",
    CASE 
        WHEN created_at = updated_at THEN '🆕 신규생성'
        ELSE '🔄 기존수정'
    END as "생성여부"
FROM btc_ohlc 
WHERE market = 'btc_4h'
    AND EXTRACT(HOUR FROM candle_start_at) = 12
ORDER BY candle_start_at DESC;

-- 3. 현재 시각 확인
SELECT NOW() as "현재시각_UTC", NOW() AT TIME ZONE 'Asia/Seoul' as "현재시각_KST";