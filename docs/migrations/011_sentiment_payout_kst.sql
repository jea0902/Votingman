-- =============================================
-- 011: sentiment_polls, sentiment_votes, payout_history 시각 컬럼 KST
--
-- 목적: 한국 사용자 대상 시각을 KST로 저장. candle_start_at은 UTC 유지.
-- - sentiment_polls: created_at, updated_at, settled_at → timestamp without time zone (KST)
-- - sentiment_votes: created_at → timestamp without time zone (KST)
-- - payout_history: settled_at → timestamp without time zone (KST)
-- =============================================

-- =============================================
-- 1. sentiment_polls
-- =============================================

-- 1-1. sentiment_polls 전용 updated_at 트리거 (KST)
CREATE OR REPLACE FUNCTION public.sentiment_polls_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := (now() AT TIME ZONE 'Asia/Seoul');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sentiment_polls_updated_at ON public.sentiment_polls;

-- 1-2. created_at → KST
ALTER TABLE public.sentiment_polls
    ALTER COLUMN created_at TYPE timestamp without time zone
    USING (created_at AT TIME ZONE 'Asia/Seoul');
ALTER TABLE public.sentiment_polls
    ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'Asia/Seoul');

-- 1-3. updated_at → KST
ALTER TABLE public.sentiment_polls
    ALTER COLUMN updated_at TYPE timestamp without time zone
    USING (updated_at AT TIME ZONE 'Asia/Seoul');
ALTER TABLE public.sentiment_polls
    ALTER COLUMN updated_at SET DEFAULT (now() AT TIME ZONE 'Asia/Seoul');

-- 1-4. settled_at → KST (NULL 허용 유지)
ALTER TABLE public.sentiment_polls
    ALTER COLUMN settled_at TYPE timestamp without time zone
    USING (CASE WHEN settled_at IS NULL THEN NULL ELSE (settled_at AT TIME ZONE 'Asia/Seoul') END);
-- 기본값은 앱에서 넣을 때 KST로 넣으므로 여기서는 제거만 (기존 DEFAULT now() 제거 후 재설정 안 함)
ALTER TABLE public.sentiment_polls
    ALTER COLUMN settled_at DROP DEFAULT;

-- 1-5. updated_at 트리거 부착
CREATE TRIGGER sentiment_polls_updated_at
    BEFORE UPDATE ON public.sentiment_polls
    FOR EACH ROW
    EXECUTE PROCEDURE public.sentiment_polls_set_updated_at();

COMMENT ON COLUMN public.sentiment_polls.created_at IS '생성 시각 (KST, timestamp without time zone)';
COMMENT ON COLUMN public.sentiment_polls.updated_at IS '수정 시각 (KST, timestamp without time zone)';
COMMENT ON COLUMN public.sentiment_polls.settled_at IS '정산 완료 시각 (KST). NULL이면 미정산';

-- =============================================
-- 2. sentiment_votes
-- =============================================

ALTER TABLE public.sentiment_votes
    ALTER COLUMN created_at TYPE timestamp without time zone
    USING (created_at AT TIME ZONE 'Asia/Seoul');
ALTER TABLE public.sentiment_votes
    ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'Asia/Seoul');

COMMENT ON COLUMN public.sentiment_votes.created_at IS '투표 시각 (KST, timestamp without time zone)';

-- =============================================
-- 3. payout_history
-- =============================================

ALTER TABLE public.payout_history
    ALTER COLUMN settled_at TYPE timestamp without time zone
    USING (settled_at AT TIME ZONE 'Asia/Seoul');
ALTER TABLE public.payout_history
    ALTER COLUMN settled_at SET DEFAULT (now() AT TIME ZONE 'Asia/Seoul');

COMMENT ON COLUMN public.payout_history.settled_at IS '정산 시각 (KST, timestamp without time zone)';

-- =============================================
-- 실행 후 확인 (선택)
-- =============================================
-- SELECT id, poll_date, market, created_at, updated_at, settled_at, candle_start_at FROM public.sentiment_polls ORDER BY created_at DESC LIMIT 5;
-- SELECT id, poll_id, created_at FROM public.sentiment_votes ORDER BY created_at DESC LIMIT 5;
-- SELECT id, poll_id, user_id, settled_at FROM public.payout_history ORDER BY settled_at DESC LIMIT 5;
