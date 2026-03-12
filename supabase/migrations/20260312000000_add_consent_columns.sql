-- 회원가입 시 약관 동의 여부 저장용 컬럼 추가
-- privacy_agreed: 개인정보 수집·이용 동의
-- service_agreed: 서비스 이용약관 동의
-- marketing_agree: 마케팅 정보 수신 동의 (선택) → 20260312010000에서 marketing_agreed로 rename

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS privacy_agreed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_agreed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_agree boolean DEFAULT false;

-- 기존 유저: privacy_agreed_at이 있으면 privacy_agreed = true
UPDATE public.users
SET privacy_agreed = true
WHERE privacy_agreed_at IS NOT NULL AND (privacy_agreed IS NULL OR privacy_agreed = false);

COMMENT ON COLUMN public.users.privacy_agreed IS '개인정보 수집·이용 동의 여부';
COMMENT ON COLUMN public.users.service_agreed IS '서비스 이용약관 동의 여부';
COMMENT ON COLUMN public.users.marketing_agree IS '마케팅 정보 수신 동의 여부 (선택)';
