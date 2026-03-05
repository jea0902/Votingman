-- =============================================
-- notifications 테이블 생성
-- 사용자 알림 (정산 완료, 시스템 알림 등)
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'payout',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  related_payout_id UUID REFERENCES payout_history(id) ON DELETE SET NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at 
ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read 
ON notifications (user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON notifications (type);

CREATE INDEX IF NOT EXISTS idx_notifications_related_payout_id 
ON notifications (related_payout_id);

-- RLS (Row Level Security) 활성화
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 정책 생성: 사용자는 본인의 알림만 조회/수정 가능
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;  
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 시스템이 알림을 생성할 수 있도록 허용 (트리거용)
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- 테이블 코멘트
COMMENT ON TABLE notifications IS '사용자 알림 테이블 (정산 완료, 시스템 알림 등)';
COMMENT ON COLUMN notifications.type IS '알림 타입: payout(정산), vote_result(투표결과), system(시스템)';
COMMENT ON COLUMN notifications.title IS '알림 제목 (투표 제목 등)';
COMMENT ON COLUMN notifications.content IS '알림 내용 (정산 결과 등)';
COMMENT ON COLUMN notifications.metadata IS '메타데이터 (정산 상세, 링크 등)';
COMMENT ON COLUMN notifications.related_payout_id IS '관련된 정산 내역 ID (옵셔널)';

-- 샘플 데이터 생성 (테스트용 - 실제 환경에서는 제거)
-- INSERT INTO notifications (
--   user_id, 
--   type, 
--   title, 
--   content, 
--   metadata,
--   related_payout_id
-- ) VALUES (
--   'YOUR_USER_ID_HERE',
--   'payout',
--   '📊 비트코인 내일 상승/하락 예측',
--   '정산이 완료되었습니다. +1,250 VTC',
--   jsonb_build_object(
--     'payout_id', 'test-payout-id',
--     'poll_id', 'test-poll-id',
--     'poll_date', '2026-03-01',
--     'market', 'btc',
--     'bet_amount', 500,
--     'payout_amount', 1750,
--     'profit', 1250,
--     'is_win', true,
--     'is_draw', false,
--     'redirect_url', '/profile/stats'
--   ),
--   NULL
-- );