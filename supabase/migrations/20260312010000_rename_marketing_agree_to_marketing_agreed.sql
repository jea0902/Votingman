-- marketing_agree → marketing_agreed 정리
-- marketing_agreed가 이미 있으면 marketing_agree만 제거, 없으면 rename

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'marketing_agreed'
  ) THEN
    -- marketing_agreed 이미 있음: marketing_agree가 있으면 데이터 복사 후 제거
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'marketing_agree'
    ) THEN
      ALTER TABLE public.users DROP COLUMN marketing_agree;
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'marketing_agree'
  ) THEN
    -- marketing_agree만 있음: rename
    ALTER TABLE public.users RENAME COLUMN marketing_agree TO marketing_agreed;
  END IF;
END $$;

COMMENT ON COLUMN public.users.marketing_agreed IS '마케팅 정보 수신 동의 여부 (선택)';
