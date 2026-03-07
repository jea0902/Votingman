-- 정산 시 소수 VTC(7053.47 등) 저장으로 bigint 컬럼 에러 방지
-- 에러: invalid input syntax for type bigint: "7053.47"
-- 원인: users.voting_coin_balance, payout_history.payout_amount/bet_amount 가 bigint
-- 조치: numeric(20,2)로 변경하여 소수점 2자리까지 저장

-- users.voting_coin_balance (NULL 유지)
ALTER TABLE public.users
  ALTER COLUMN voting_coin_balance TYPE numeric(20,2)
  USING (voting_coin_balance::numeric);

-- payout_history
ALTER TABLE public.payout_history
  ALTER COLUMN payout_amount TYPE numeric(20,2)
  USING (payout_amount::numeric);

ALTER TABLE public.payout_history
  ALTER COLUMN bet_amount TYPE numeric(20,2)
  USING (bet_amount::numeric);
