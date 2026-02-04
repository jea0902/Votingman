-- =============================================
-- 001: users.virtual_cash_balance → voting_coin_balance 컬럼 이름 변경
-- =============================================
-- Supabase DB에 이미 존재하는 virtual_cash_balance를 보팅맨 보팅코인 잔액 용도로 사용하기 위해 이름만 변경합니다.
-- 기존 값(예: 10000)은 그대로 유지됩니다.

ALTER TABLE public.users
  RENAME COLUMN virtual_cash_balance TO voting_coin_balance;

COMMENT ON COLUMN public.users.voting_coin_balance IS '보팅맨 보팅코인 잔액 (기존 virtual_cash_balance에서 이름 변경, 기본값 10000 유지)';
