-- =============================================
-- 005: 정산 완료 플래그 (재실행 방지)
-- 실행 순서: 001~004 적용 후 실행
-- =============================================

ALTER TABLE public.sentiment_polls
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sentiment_polls.settled_at IS '정산 완료 시각. NULL이면 미정산, 값 있으면 재정산 방지';
