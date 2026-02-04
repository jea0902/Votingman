-- =============================================
-- 003: users 테이블 RLS — 본인 행만 조회·갱신
-- 보팅맨 2단계: 보팅코인 잔액 조회/갱신은 본인만 허용
-- =============================================
-- Supabase SQL Editor에서 001, 002 적용 후 실행

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 본인 행만 SELECT (보팅코인 잔액 등 조회)
CREATE POLICY "Users can read own row"
    ON public.users FOR SELECT
    USING (user_id = auth.uid());

-- 본인 행만 UPDATE (잔액 갱신은 서버에서 service_role로 수행 가능)
CREATE POLICY "Users can update own row"
    ON public.users FOR UPDATE
    USING (user_id = auth.uid());

-- INSERT: 회원 가입 시 행 생성은 보통 트리거 또는 API(service_role)에서 수행.
-- 클라이언트에서 본인 user_id로 생성해야 하면 아래 정책 추가.
-- CREATE POLICY "Users can insert own row" ON public.users FOR INSERT WITH CHECK (user_id = auth.uid());
