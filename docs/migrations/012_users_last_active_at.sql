-- =============================================
-- 012: users.last_active_at — 최근 5분 내 활성 유저 수용
-- 관리자 대시보드에서 활성 유저 집계에 사용
-- =============================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.last_active_at IS '마지막 활동 시각 (heartbeat API로 갱신)';
