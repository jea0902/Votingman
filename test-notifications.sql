-- =============================================
-- 정산 알림 시스템 테스트 SQL
-- =============================================

-- 1. 현재 사용자 정보 확인
SELECT 
  u.user_id,
  u.nickname,
  u.email
FROM users u 
WHERE u.deleted_at IS NULL
ORDER BY u.created_at DESC
LIMIT 5;

-- 2. 기존 sentiment_polls 데이터 확인 (트리거에서 참조용)
SELECT 
  id as poll_id,
  poll_date,
  market,
  btc_open,
  btc_close,
  created_at
FROM sentiment_polls 
ORDER BY created_at DESC 
LIMIT 3;

-- 3. 기존 payout_history 확인
SELECT 
  id,
  user_id,
  poll_id,
  market,
  bet_amount,
  payout_amount,
  created_at
FROM payout_history 
ORDER BY created_at DESC 
LIMIT 3;

-- 4. 기존 notifications 확인
SELECT 
  id,
  user_id,
  type,
  title,
  content,
  is_read,
  created_at
FROM notifications 
ORDER BY created_at DESC 
LIMIT 5;

-- =============================================
-- 테스트 시나리오 실행
-- =============================================

-- 💡 주의: 아래 값들을 위 쿼리 결과로 실제 값으로 교체하세요!

-- 시나리오 1: 승리 케이스 (+수익)
-- YOUR_USER_ID와 YOUR_POLL_ID를 실제 값으로 교체
INSERT INTO payout_history (
  user_id, 
  poll_id, 
  market, 
  bet_amount, 
  payout_amount
) VALUES (
  'YOUR_USER_ID',     -- 위에서 확인한 실제 user_id로 교체
  'YOUR_POLL_ID',     -- 위에서 확인한 실제 poll_id로 교체  
  'btc',
  500,                -- 베팅액
  1250                -- 정산액 (승리: +750 수익)
);

-- 시나리오 2: 패배 케이스 (-손실)
INSERT INTO payout_history (
  user_id, 
  poll_id, 
  market, 
  bet_amount, 
  payout_amount
) VALUES (
  'YOUR_USER_ID',     -- 위에서 확인한 실제 user_id로 교체
  'YOUR_POLL_ID',     -- 위에서 확인한 실제 poll_id로 교체
  'btc',
  1000,               -- 베팅액  
  300                 -- 정산액 (패배: -700 손실)
);

-- 시나리오 3: 무승부 케이스 (원금 반환)
INSERT INTO payout_history (
  user_id, 
  poll_id, 
  market, 
  bet_amount, 
  payout_amount
) VALUES (
  'YOUR_USER_ID',     -- 위에서 확인한 실제 user_id로 교체
  'YOUR_POLL_ID',     -- 위에서 확인한 실제 poll_id로 교체
  'ndq',
  800,                -- 베팅액
  800                 -- 정산액 (무승부: 0 수익)
);

-- =============================================
-- 테스트 결과 확인
-- =============================================

-- 5. 새로 생성된 알림 확인
SELECT 
  n.id,
  n.user_id,
  n.type,
  n.title,
  n.content,
  n.metadata,
  n.is_read,
  n.created_at,
  n.related_payout_id
FROM notifications n
WHERE n.created_at > NOW() - INTERVAL '1 hour'  -- 최근 1시간 내 생성된 알림
ORDER BY n.created_at DESC;

-- 6. 사용자별 읽지 않은 알림 수 확인
SELECT 
  u.nickname,
  COUNT(n.id) as unread_count
FROM users u
LEFT JOIN notifications n ON u.user_id = n.user_id AND n.is_read = false
WHERE u.deleted_at IS NULL
GROUP BY u.user_id, u.nickname
HAVING COUNT(n.id) > 0;

-- 7. 메타데이터 상세 확인 (JSON 파싱)
SELECT 
  n.title,
  n.content,
  n.metadata->>'market' as market,
  n.metadata->>'bet_amount' as bet_amount,
  n.metadata->>'payout_amount' as payout_amount,
  n.metadata->>'profit' as profit,
  n.metadata->>'is_win' as is_win,
  n.metadata->>'is_draw' as is_draw,
  n.created_at
FROM notifications n
WHERE n.created_at > NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC;