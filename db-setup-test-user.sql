-- =========================================
-- 테스트용 더미 사용자 추가
-- =========================================
-- 게시글 작성 API가 임시로 사용할 고정 user_id를 위한 더미 사용자
-- 실제 인증 구현 후에는 이 사용자는 사용되지 않습니다.

-- 1. auth.users 테이블에 더미 사용자 추가 (Supabase Auth)
-- 주의: 이 쿼리는 실패할 수 있습니다. auth.users는 Supabase Auth가 관리하므로
--       직접 INSERT가 불가능할 수 있습니다. 그럴 경우 아래 2번만 실행하세요.

-- INSERT INTO auth.users (
--   id,
--   instance_id,
--   email,
--   encrypted_password,
--   email_confirmed_at,
--   created_at,
--   updated_at,
--   aud,
--   role
-- ) VALUES (
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'temp-user@bitcos.local',
--   '$2a$10$DUMMY_HASH', -- 더미 해시
--   now(),
--   now(),
--   now(),
--   'authenticated',
--   'authenticated'
-- )
-- ON CONFLICT (id) DO NOTHING;

-- 2. public.users 테이블에 더미 프로필 추가
-- 이것만 실행하면 됩니다 (FK 체크를 임시로 우회)
-- RLS가 활성화되어 있으면 이 쿼리가 실패할 수 있으므로,
-- Supabase 대시보드의 SQL Editor에서 직접 실행하세요.

-- RLS 임시 비활성화 (필요 시)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts DISABLE ROW LEVEL SECURITY;

-- FK 제약조건 임시 비활성화 (더미 user_id 삽입 허용)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_id_fkey;

-- 더미 사용자 추가
INSERT INTO public.users (
  user_id,
  email,
  nickname,
  profile_image,
  role,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'temp@bitcos.local',
  '임시사용자',
  null,
  'USER',
  now()
)
ON CONFLICT (user_id) DO NOTHING;

-- 완료 메시지
SELECT 
  'Temp user created successfully!' as message,
  user_id,
  nickname
FROM public.users
WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid;

-- =========================================
-- 중요: 인증 구현 후 정리 방법
-- =========================================
-- 인증 기능 추가 후 이 더미 사용자와 관련 게시글을 정리하려면:

-- 1. 더미 사용자가 작성한 게시글 삭제
-- DELETE FROM public.board_posts 
-- WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid;

-- 2. 더미 사용자 삭제
-- DELETE FROM public.users 
-- WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid;

-- 3. FK 제약조건 다시 활성화
-- ALTER TABLE public.users 
-- ADD CONSTRAINT users_user_id_fkey 
-- FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- 4. RLS 다시 활성화
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
