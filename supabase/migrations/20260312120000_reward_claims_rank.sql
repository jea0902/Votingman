-- reward_claims에 rank(신청 당시 순위) 컬럼 추가

ALTER TABLE public.reward_claims
  ADD COLUMN IF NOT EXISTS rank integer;

COMMENT ON COLUMN public.reward_claims.rank IS '신청 당시 user_stats MMR 기준 순위 (1~10)';
