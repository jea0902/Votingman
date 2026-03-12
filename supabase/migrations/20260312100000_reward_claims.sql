-- TOP 10 보상 수령 신청 저장용 테이블
-- 월말 스냅샷 기준, TOP 10 유저가 신청 → 관리자가 수동 지급
-- period: 해당 월 (YYYY-MM), paid_at: 관리자가 보상 지급 완료한 시각

CREATE TABLE IF NOT EXISTS public.reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  period text NOT NULL,
  phone_number text NOT NULL,
  privacy_consent boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_reward_claims_user_id ON public.reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_claims_period ON public.reward_claims(period);
CREATE INDEX IF NOT EXISTS idx_reward_claims_paid_at ON public.reward_claims(paid_at) WHERE paid_at IS NULL;

COMMENT ON TABLE public.reward_claims IS 'TOP 10 보상(선물하기 3만원권) 수령 신청 정보. 월별 스냅샷 기준, 관리자 수동 지급';
COMMENT ON COLUMN public.reward_claims.period IS '보상 대상 월 (YYYY-MM). 월말 스냅샷 기준';
COMMENT ON COLUMN public.reward_claims.phone_number IS '보상 수령용 휴대폰 번호';
COMMENT ON COLUMN public.reward_claims.privacy_consent IS '개인정보 수집·이용 동의 여부';
COMMENT ON COLUMN public.reward_claims.paid_at IS '관리자가 보상 지급 완료한 시각. NULL이면 미지급';

-- RLS: API에서 createSupabaseAdmin(service_role) 사용 → RLS 우회
-- anon/authenticated 직접 접근 차단
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access" ON public.reward_claims
  FOR ALL
  USING (false);
