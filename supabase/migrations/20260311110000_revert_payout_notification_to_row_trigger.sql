-- =============================================
-- 무효 알림 미발송 수정: bulk 트리거 → ROW 트리거 복원
-- FOR EACH STATEMENT + transition table이 일부 환경에서 동작하지 않아 알림 미발송
-- 무효(payout_amount=bet_amount) 포함 모든 정산 결과에 알림 전송
-- =============================================

DROP TRIGGER IF EXISTS payout_notification_trigger ON payout_history;
DROP FUNCTION IF EXISTS public.notify_payout_insert_bulk();

-- ROW 트리거 복원 (무효/승리/패배 모두 알림)
CREATE OR REPLACE FUNCTION notify_payout_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- payout_amount 의미: 승리=수익(양수), 패배=0, 무효=bet(원금반환)
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

COMMENT ON FUNCTION public.notify_payout_insert() IS '정산용: payout_history insert 시 알림 생성 (무효/승리/패배 모두)';
