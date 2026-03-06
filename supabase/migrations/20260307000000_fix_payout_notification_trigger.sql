-- =============================================
-- payout_notification_trigger 수정
-- payout_amount 의미: 승리=수익(양수), 패배=0, 무효=bet(원금반환)
-- 기존: payout_amount > bet_amount 로 승리 판정 (잘못됨)
-- 수정: payout_amount > 0 && payout_amount != bet_amount → 승리
-- =============================================

-- 기존 트리거/함수 제거 (함수명이 다르면 Supabase 대시보드에서 확인 후 수정)
DROP TRIGGER IF EXISTS payout_notification_trigger ON payout_history;
DROP FUNCTION IF EXISTS public.notify_payout_insert();

-- 수정된 트리거 함수 생성
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

  -- payout_amount 의미: 승리=수익(양수), 패배=0, 무효=bet(원금반환)
  IF NEW.payout_amount = 0 THEN
    -- 패배
    v_is_win := false;
    v_is_invalid := false;
    v_profit := -NEW.bet_amount;
    v_content := '정산이 완료되었습니다. ' || to_char(-NEW.bet_amount, 'FM999,999,990.00') || ' VTC';
  ELSIF NEW.payout_amount = NEW.bet_amount THEN
    -- 무효 (원금 반환)
    v_is_win := false;
    v_is_invalid := true;
    v_profit := 0;
    v_content := '무효 처리되어 원금이 반환되었습니다 (' || to_char(NEW.bet_amount, 'FM999,999,990.00') || ' VTC)';
  ELSE
    -- 승리 (payout_amount = 수익)
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

-- 트리거 재생성
CREATE TRIGGER payout_notification_trigger
  AFTER INSERT ON payout_history
  FOR EACH ROW
  EXECUTE FUNCTION notify_payout_insert();
