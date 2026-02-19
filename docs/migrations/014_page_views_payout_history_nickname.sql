-- =============================================
-- 014: page_views, payout_history에 nickname 컬럼 추가
-- 관리자가 조회 시 user_id 대신 닉네임으로 표시하기 위함
-- =============================================

-- 1. page_views
ALTER TABLE public.page_views
ADD COLUMN IF NOT EXISTS nickname TEXT;

COMMENT ON COLUMN public.page_views.nickname IS '페이지뷰 발생 시점의 유저 닉네임 (관리자 조회용, 비로그인 시 NULL)';

UPDATE public.page_views p
SET nickname = u.nickname
FROM public.users u
WHERE p.user_id = u.user_id
  AND u.deleted_at IS NULL
  AND p.nickname IS NULL;


-- 2. payout_history
ALTER TABLE public.payout_history
ADD COLUMN IF NOT EXISTS nickname TEXT;

COMMENT ON COLUMN public.payout_history.nickname IS '당첨자 닉네임 (관리자 조회용)';

UPDATE public.payout_history p
SET nickname = u.nickname
FROM public.users u
WHERE p.user_id = u.user_id
  AND u.deleted_at IS NULL
  AND p.nickname IS NULL;
