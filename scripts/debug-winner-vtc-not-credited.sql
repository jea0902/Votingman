-- =============================================
-- 승자 VTC 미지급 디버깅
-- =============================================
-- 증상: payout_history 기록됨, 알림 감 → 승자 잔액 미증가
-- =============================================

-- 1) 최근 정산된 폴 + 승자/패자 + users 테이블 매칭
WITH recent_settled AS (
  SELECT id, market, candle_start_at, settled_at
  FROM sentiment_polls
  WHERE settled_at IS NOT NULL
  ORDER BY settled_at DESC
  LIMIT 5
),
winners AS (
  SELECT ph.poll_id, ph.user_id, ph.bet_amount, ph.payout_amount,
         v.choice
  FROM payout_history ph
  JOIN sentiment_votes v ON v.poll_id = ph.poll_id AND v.user_id = ph.user_id AND v.bet_amount > 0
  JOIN recent_settled rs ON rs.id = ph.poll_id
  WHERE ph.payout_amount > 0  -- 승자만
)
SELECT 
  w.poll_id,
  w.user_id,
  w.bet_amount,
  w.payout_amount AS profit,
  w.bet_amount + w.payout_amount AS should_receive_total,
  u.user_id AS users_user_id,
  u.voting_coin_balance,
  CASE WHEN u.user_id IS NULL THEN '⚠️ users 테이블에 없음' ELSE 'OK' END AS users_exists
FROM winners w
LEFT JOIN users u ON u.user_id = w.user_id AND u.deleted_at IS NULL;

-- 2) users 테이블 컬럼 확인 (user_id vs id)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'users' 
ORDER BY ordinal_position;

-- 3) 수동 보정: 미지급된 VTC 반영 (poll_id를 실제 값으로 교체 후 실행)
-- 주의: 이미 지급된 경우 중복 지급되므로, 1번 쿼리로 users_exists='OK'인데 잔액이 안 올랐는지 먼저 확인
-- bet_amount + payout_amount = 원금 + 수익 (수수료 차감 후)
/*
UPDATE users u
SET voting_coin_balance = u.voting_coin_balance + ph.bet_amount + ph.payout_amount
FROM payout_history ph
WHERE u.user_id = ph.user_id
  AND ph.poll_id = '여기에_poll_id_입력'
  AND ph.payout_amount > 0;
*/
