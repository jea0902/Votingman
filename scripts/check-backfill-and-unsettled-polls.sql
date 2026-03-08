-- ============================================================
-- 1) btc_4h 봉 확인 (3월 6~7일)
-- ============================================================

SELECT id, market, candle_start_at, candle_start_at_kst, open, close, high, low, updated_at
FROM btc_ohlc
WHERE market = 'btc_4h'
  AND candle_start_at >= '2026-03-06'
  AND candle_start_at < '2026-03-08'
ORDER BY candle_start_at;

-- ----------------------------------------
-- 1-1) KST 정렬 여부: candle_start_at_kst 시각이 00/04/08/12/16/20 시면 KST 정렬
--      UTC 정렬(예전): 01/05/09/13/17/21 시 (KST) = 00/04/08/12/16/20 UTC
-- ----------------------------------------
SELECT candle_start_at, candle_start_at_kst,
  CASE WHEN SUBSTRING(candle_start_at_kst::text FROM 12 FOR 2) IN ('00','04','08','12','16','20')
       THEN 'KST 정렬' ELSE 'UTC 정렬(예전)' END AS alignment
FROM btc_ohlc
WHERE market = 'btc_4h'
  AND candle_start_at >= '2026-03-06'
  AND candle_start_at < '2026-03-08'
ORDER BY candle_start_at;

-- ----------------------------------------
-- 1-2) btc_4h 전체 개수 (KST/UTC 구분 없이)
-- ----------------------------------------
SELECT COUNT(*) AS btc_4h_total FROM btc_ohlc WHERE market = 'btc_4h';

-- ----------------------------------------
-- 1-3) btc_4h 중 KST 기준 행만 조회 (00/04/08/12/16/20 시)
-- ----------------------------------------
SELECT id, market, candle_start_at, candle_start_at_kst, open, close, high, low, updated_at
FROM btc_ohlc
WHERE market = 'btc_4h'
  AND SUBSTRING(candle_start_at_kst::text FROM 12 FOR 2) IN ('00','04','08','12','16','20')
ORDER BY candle_start_at DESC;

-- ----------------------------------------
-- 1-4) btc_4h 최근 10건 (전부, 정렬 구분 없이)
-- ----------------------------------------
SELECT id, candle_start_at, candle_start_at_kst, open, close, updated_at
FROM btc_ohlc
WHERE market = 'btc_4h'
ORDER BY candle_start_at DESC
LIMIT 10;


-- ============================================================
-- 2) 아직 정산 안 된 폴 (settled_at 이 NULL)
--    btc_4h / btc_1d 등 시장별로 확인
-- ============================================================

SELECT id, poll_date, market, candle_start_at, settled_at, created_at
FROM sentiment_polls
WHERE settled_at IS NULL
  AND market IN ('btc_4h', 'btc_1d', 'btc_1h', 'btc_15m', 'btc_5m')
ORDER BY market, candle_start_at DESC NULLS LAST, poll_date DESC;


-- ============================================================
-- 3) UTC 시절 btc_4h 데이터 삭제 (예전 Binance 4h 그대로 넣었던 행만)
--    candle_start_at UTC 시각이 00/04/08/12/16/20 시인 행 = UTC 정렬
-- ============================================================

-- 3-1) 지울 행 미리보기 (실행 후 건수/내용 확인)
SELECT id, market, candle_start_at, candle_start_at_kst
FROM btc_ohlc
WHERE market = 'btc_4h'
  AND EXTRACT(HOUR FROM candle_start_at AT TIME ZONE 'UTC') IN (0, 4, 8, 12, 16, 20)
ORDER BY candle_start_at;

-- 3-2) 삭제 실행 (3-1 결과 확인 후 실행)
-- DELETE FROM btc_ohlc
-- WHERE market = 'btc_4h'
--   AND EXTRACT(HOUR FROM candle_start_at AT TIME ZONE 'UTC') IN (0, 4, 8, 12, 16, 20);
