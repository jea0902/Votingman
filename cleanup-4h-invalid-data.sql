-- =============================================
-- 4시간봉 잘못된 KST 기준 데이터 정리
-- =============================================

-- 1. 현재 상황 백업 (삭제 전 기록)
SELECT 
    EXTRACT(HOUR FROM candle_start_at) as "UTC시간",
    COUNT(*) as "삭제예정개수",
    MIN(candle_start_at) as "가장오래된캔들",
    MAX(candle_start_at) as "가장최근캔들"
FROM btc_ohlc 
WHERE market = 'btc_4h'
    AND EXTRACT(HOUR FROM candle_start_at) NOT IN (0,4,8,12,16,20)  -- 비정상 시간
GROUP BY EXTRACT(HOUR FROM candle_start_at)
ORDER BY "UTC시간";

-- 2. 실제 삭제 실행 (주의: 되돌릴 수 없음)
-- DELETE FROM btc_ohlc 
-- WHERE market = 'btc_4h'
--     AND EXTRACT(HOUR FROM candle_start_at) NOT IN (0,4,8,12,16,20);

-- 3. 삭제 후 남은 데이터 확인
-- SELECT 
--     EXTRACT(HOUR FROM candle_start_at) as "UTC시간",
--     COUNT(*) as "남은개수"
-- FROM btc_ohlc 
-- WHERE market = 'btc_4h'
-- GROUP BY EXTRACT(HOUR FROM candle_start_at)
-- ORDER BY "UTC시간";