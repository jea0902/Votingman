-- =============================================
-- 무효 판정 통합 알림 트리거 
-- =============================================

-- 기존 트리거와 함수 삭제
DROP TRIGGER IF EXISTS payout_notification_trigger ON payout_history;
DROP FUNCTION IF EXISTS create_payout_notification();

-- 무효 판정 통합된 트리거 함수 생성
CREATE OR REPLACE FUNCTION create_payout_notification()
RETURNS TRIGGER AS $$
DECLARE
    poll_info RECORD;
    is_win BOOLEAN;
    is_invalid BOOLEAN;
    profit NUMERIC;
    notification_title TEXT;
    notification_content TEXT;
    payout_display TEXT;
BEGIN
    -- 투표 정보 조회 (제목 생성용)
    SELECT 
        sp.poll_date,
        sp.market
    INTO poll_info
    FROM sentiment_polls sp 
    WHERE sp.id = NEW.poll_id;
    
    -- 수익/손실 계산
    profit := NEW.payout_amount - NEW.bet_amount;
    is_win := profit > 0;
    is_invalid := profit = 0;
    
    -- 투표 제목 생성
    CASE 
        WHEN poll_info.market = 'btc' THEN
            notification_title := '비트코인 내일 상승/하락 예측';
        WHEN poll_info.market = 'ndq' THEN  
            notification_title := '나스닥 내일 상승/하락 예측';
        WHEN poll_info.market = 'sp500' THEN
            notification_title := 'S&P500 내일 상승/하락 예측';
        WHEN poll_info.market = 'kospi' THEN
            notification_title := '코스피 내일 상승/하락 예측';
        WHEN poll_info.market = 'kosdaq' THEN
            notification_title := '코스닥 내일 상승/하락 예측';
        ELSE
            notification_title := COALESCE(poll_info.market, '시장') || ' 투표 예측';
    END CASE;
    
    -- 정산 결과 표시 텍스트 생성
    IF is_invalid THEN
        payout_display := '무효 처리되어 원금이 반환되었습니다 (' || NEW.payout_amount || ' VTC)';
        notification_content := payout_display;
    ELSIF is_win THEN
        payout_display := '+' || profit || ' VTC';
        notification_content := '정산이 완료되었습니다. ' || payout_display;
    ELSE
        payout_display := profit || ' VTC';
        notification_content := '정산이 완료되었습니다. ' || payout_display;
    END IF;
    
    -- 알림 레코드 삽입
    INSERT INTO notifications (
        user_id, 
        type, 
        title, 
        content, 
        metadata, 
        related_payout_id
    ) VALUES (
        NEW.user_id,
        'payout',
        notification_title,
        notification_content,
        jsonb_build_object(
            'payout_id', NEW.id,
            'poll_id', NEW.poll_id,
            'poll_date', poll_info.poll_date,
            'market', poll_info.market,
            'bet_amount', NEW.bet_amount,
            'payout_amount', NEW.payout_amount,
            'profit', profit,
            'is_win', is_win,
            'is_invalid', is_invalid,
            'redirect_url', '/profile/stats'
        ),
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성
CREATE TRIGGER payout_notification_trigger
    AFTER INSERT ON payout_history
    FOR EACH ROW
    EXECUTE FUNCTION create_payout_notification();

-- 성공 메시지
SELECT '✅ 무효 판정이 통합된 알림 트리거가 성공적으로 업데이트되었습니다!' as status;