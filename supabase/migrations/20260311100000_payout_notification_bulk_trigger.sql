-- =============================================
-- 정산 속도 최적화: 알림 트리거 FOR EACH STATEMENT + bulk insert
-- 기존: N건 insert 시 트리거 N회 실행, sentiment_polls N회 조회, notifications N회 insert
-- 변경: 1회 실행, sentiment_polls 1회 JOIN, notifications 1회 bulk insert
-- =============================================

DROP TRIGGER IF EXISTS payout_notification_trigger ON payout_history;
DROP FUNCTION IF EXISTS public.notify_payout_insert();

-- 새 STATEMENT 트리거용 bulk 함수 생성
CREATE OR REPLACE FUNCTION notify_payout_insert_bulk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, content, metadata, is_read, related_payout_id)
  SELECT
    n.user_id,
    'payout',
    COALESCE(n.market, '') || ' 투표 예측',
    CASE
      WHEN n.payout_amount = 0 THEN
        '정산이 완료되었습니다. ' || to_char(-n.bet_amount, 'FM999,999,990.00') || ' VTC'
      WHEN n.payout_amount = n.bet_amount THEN
        '무효 처리되어 원금이 반환되었습니다 (' || to_char(n.bet_amount, 'FM999,999,990.00') || ' VTC)'
      ELSE
        '정산이 완료되었습니다. +' || to_char(n.payout_amount, 'FM999,999,990.00') || ' VTC'
    END,
    jsonb_build_object(
      'payout_id', n.id,
      'poll_id', n.poll_id,
      'poll_date', COALESCE(sp.poll_date, ''),
      'market', COALESCE(n.market, ''),
      'bet_amount', n.bet_amount,
      'payout_amount', n.payout_amount,
      'profit', CASE
        WHEN n.payout_amount = 0 THEN -n.bet_amount
        WHEN n.payout_amount = n.bet_amount THEN 0
        ELSE n.payout_amount
      END,
      'is_win', (n.payout_amount <> 0 AND n.payout_amount <> n.bet_amount),
      'is_invalid', (n.payout_amount = n.bet_amount),
      'redirect_url', '/profile/stats'
    ),
    false,
    n.id
  FROM new_rows n
  LEFT JOIN sentiment_polls sp ON sp.id = n.poll_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER payout_notification_trigger
  AFTER INSERT ON payout_history
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_payout_insert_bulk();

COMMENT ON FUNCTION public.notify_payout_insert_bulk() IS '정산용: payout_history bulk insert 시 알림 일괄 생성 (FOR EACH STATEMENT)';
