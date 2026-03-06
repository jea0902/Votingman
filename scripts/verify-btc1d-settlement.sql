-- =============================================
-- btc_1d 투표/정산 검증 쿼리
-- =============================================
-- 1. btc_1d 정산 시각: cron btc-ohlc-daily가 매일 KST 09:00에 실행
-- 2. 정산 대상: 직전 UTC 00:00 캔들 (예: 3/7 09:00 KST 정산 → 3/6 00:00 UTC 캔들)
-- 3. 투표 사라짐 확인: sentiment_votes + sentiment_polls + payout_history 조인
-- =============================================

-- 1) 최근 btc_1d 폴 목록 (poll_date, candle_start_at, 정산 여부)
SELECT 
    id AS poll_id,
    poll_date,
    candle_start_at,
    settled_at,
    long_count,
    short_count,
    long_coin_total,
    short_coin_total,
    created_at
FROM sentiment_polls
WHERE market = 'btc_1d'
ORDER BY candle_start_at DESC
LIMIT 10;

-- 2) 특정 폴의 투표 건수 (6명 투표했는지 확인)
-- poll_id를 위 결과에서 확인 후 아래에 넣기
/*
SELECT 
    v.id,
    v.poll_id,
    v.user_id,
    v.choice,
    v.bet_amount,
    v.created_at
FROM sentiment_votes v
WHERE v.poll_id = '여기에_poll_id_입력'
  AND v.bet_amount > 0
ORDER BY v.created_at;
*/

-- 3) 3월 6일~7일 btc_1d 폴 + 투표 수 + 정산 여부 (한 번에 확인)
SELECT 
    p.id AS poll_id,
    p.poll_date,
    p.candle_start_at,
    p.settled_at,
    p.long_count,
    p.short_count,
    (SELECT COUNT(*) FROM sentiment_votes v 
     WHERE v.poll_id = p.id AND v.bet_amount > 0) AS actual_vote_count,
    (SELECT COUNT(*) FROM payout_history ph 
     WHERE ph.poll_id = p.id) AS payout_count
FROM sentiment_polls p
WHERE p.market = 'btc_1d'
  AND p.candle_start_at >= '2026-03-05T00:00:00Z'
  AND p.candle_start_at < '2026-03-09T00:00:00Z'
ORDER BY p.candle_start_at;

-- 4) btc_ohlc에 해당 캔들 존재 여부 (정산에 필요)
SELECT 
    market,
    candle_start_at,
    open,
    close,
    high,
    low,
    created_at
FROM btc_ohlc
WHERE market = 'btc_1d'
  AND candle_start_at >= '2026-03-05T00:00:00Z'
  AND candle_start_at < '2026-03-09T00:00:00Z'
ORDER BY candle_start_at;

-- =============================================
-- 5) 알림 미발송 원인 확인
-- =============================================
-- 5-1) payout_history vs notifications 매칭 여부
-- (poll_id는 위 3번 쿼리 결과에서 확인)
SELECT 
    ph.id AS payout_id,
    ph.user_id,
    ph.bet_amount,
    ph.payout_amount,
    ph.market,
    n.id AS notification_id,
    n.title,
    n.created_at AS notification_created
FROM payout_history ph
LEFT JOIN notifications n ON n.related_payout_id = ph.id
WHERE ph.poll_id = 'eb5de55e-9a4f-4147-9a3b-8c1e6fb9a6ec'  -- 3/6 정산 폴 (필요시 수정)
ORDER BY ph.payout_amount DESC;

-- 5-2) payout_notification_trigger 존재 여부 (Supabase SQL Editor에서 실행)
-- SELECT tgname, tgrelid::regclass 
-- FROM pg_trigger 
-- WHERE tgname = 'payout_notification_trigger';
