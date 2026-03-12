-- reward_claims 테이블에 KST 시각 컬럼 추가 (트리거로 자동 갱신)
-- GENERATED 컬럼은 timezone 변환이 immutable이 아니어서 사용 불가 → 트리거로 대체

DROP VIEW IF EXISTS public.reward_claims_admin;

ALTER TABLE public.reward_claims
  ADD COLUMN IF NOT EXISTS created_at_kst text;

ALTER TABLE public.reward_claims
  ADD COLUMN IF NOT EXISTS paid_at_kst text;

CREATE OR REPLACE FUNCTION public.reward_claims_set_kst()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at_kst := to_char(NEW.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS');
  NEW.paid_at_kst := CASE WHEN NEW.paid_at IS NOT NULL
    THEN to_char(NEW.paid_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')
    ELSE NULL END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reward_claims_kst_trigger ON public.reward_claims;
CREATE TRIGGER reward_claims_kst_trigger
  BEFORE INSERT OR UPDATE OF created_at, paid_at
  ON public.reward_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.reward_claims_set_kst();

-- 기존 행 백필
UPDATE public.reward_claims
SET created_at_kst = to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'),
    paid_at_kst = CASE WHEN paid_at IS NOT NULL
      THEN to_char(paid_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')
      ELSE NULL END;

COMMENT ON COLUMN public.reward_claims.created_at_kst IS 'created_at KST 표시 (YYYY-MM-DD HH24:MI:SS)';
COMMENT ON COLUMN public.reward_claims.paid_at_kst IS 'paid_at KST 표시 (YYYY-MM-DD HH24:MI:SS). NULL이면 미지급';
