-- =============================================
-- payout 알림 트리거 수정 (Supabase SQL Editor에서 실행)
-- =============================================
-- 문제: 승리자인데 전적에 패로 찍히고, 알림에 -VTC로 표시됨
-- 원인: payout_amount = 수익(profit)인데, 기존 로직은 payout_amount > bet_amount 를 승리로 판정
--       승리 시 수익은 보통 bet보다 작아서 잘못된 '패'로 분류됨
--
-- payout_amount 의미:
--   승리: 수익(양수)
--   패배: 0
--   무효: bet_amount (원금 반환)
-- =============================================

-- 1) 기존 트리거 함수명 확인 (Supabase SQL Editor에서 먼저 실행해보기):
--    SELECT p.proname FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid WHERE t.tgname = 'payout_notification_trigger';
-- 2) 아래에서 DROP 시 함수명을 확인된 이름으로 바꾸기

DROP TRIGGER IF EXISTS payout_notification_trigger ON payout_history;
-- 기존 함수 제거 (함수명이 다르면 수정 필요, 예: notify_payout_insert, payout_notification_fn 등)
DROP FUNCTION IF EXISTS notify_payout_insert();

-- 수정된 트리거 함수
CREATE OR REPLACE FUNCTION notify_payout_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_poll_date text;
  v_title text;
  v_content text;
  v_is_win boolean;
  v_is_invalid boolean;
  v_profit numeric;
  v_market text;
BEGIN
  v_market := COALESCE(NEW.market, '');
  v_title := v_market || ' 투표 예측';

  IF NEW.payout_amount = 0 THEN
    v_is_win := false;
    v_is_invalid := false;
    v_profit := -NEW.bet_amount;
    v_content := '정산이 완료되었습니다. ' || to_char(-NEW.bet_amount, 'FM999,999,990.00') || ' VTC';
  ELSIF NEW.payout_amount = NEW.bet_amount THEN
    v_is_win := false;
    v_is_invalid := true;
    v_profit := 0;
    v_content := '무효 처리되어 원금이 반환되었습니다 (' || to_char(NEW.bet_amount, 'FM999,999,990.00') || ' VTC)';
  ELSE
    v_is_win := true;
    v_is_invalid := false;
    v_profit := NEW.payout_amount;
    v_content := '정산이 완료되었습니다. +' || to_char(NEW.payout_amount, 'FM999,999,990.00') || ' VTC';
  END IF;

  SELECT poll_date INTO v_poll_date FROM sentiment_polls WHERE id = NEW.poll_id LIMIT 1;

  INSERT INTO notifications (user_id, type, title, content, metadata, is_read, related_payout_id)
  VALUES (
    NEW.user_id,
    'payout',
    v_title,
    v_content,
    jsonb_build_object(
      'payout_id', NEW.id,
      'poll_id', NEW.poll_id,
      'poll_date', COALESCE(v_poll_date, ''),
      'market', v_market,
      'bet_amount', NEW.bet_amount,
      'payout_amount', NEW.payout_amount,
      'profit', v_profit,
      'is_win', v_is_win,
      'is_invalid', v_is_invalid,
      'redirect_url', '/profile/stats'
    ),
    false,
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER payout_notification_trigger
  AFTER INSERT ON payout_history
  FOR EACH ROW
  EXECUTE FUNCTION notify_payout_insert();
