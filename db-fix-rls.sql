-- =========================================
-- RLS 정책 완전 비활성화 (임시 user_id 사용을 위해)
-- =========================================
-- 인증 기능 추가 전까지 RLS를 비활성화하여
-- 임시 user_id로도 CRUD 작업이 가능하도록 합니다.

-- 1. 모든 테이블의 RLS 비활성화
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_post_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_comment_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_bookmarks DISABLE ROW LEVEL SECURITY;

-- 2. 기존 RLS 정책 모두 삭제
DROP POLICY IF EXISTS "Anyone can view posts" ON public.board_posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.board_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.board_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.board_posts;

DROP POLICY IF EXISTS "Anyone can view comments" ON public.board_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.board_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.board_comments;

DROP POLICY IF EXISTS "Anyone can view post likes" ON public.board_post_likes;
DROP POLICY IF EXISTS "Users can manage own post likes" ON public.board_post_likes;

DROP POLICY IF EXISTS "Anyone can view comment likes" ON public.board_comment_likes;
DROP POLICY IF EXISTS "Users can manage own comment likes" ON public.board_comment_likes;

DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.board_bookmarks;
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON public.board_bookmarks;

-- 3. 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND (tablename LIKE 'board_%' OR tablename = 'users')
ORDER BY tablename;

-- 모든 테이블의 rowsecurity가 'f' (false)이면 성공!

-- =========================================
-- 완료 메시지
-- =========================================
SELECT '✅ RLS 정책이 모두 비활성화되었습니다!' as message;
SELECT '⚠️ 인증 기능 추가 후 RLS를 다시 활성화해야 합니다!' as warning;
