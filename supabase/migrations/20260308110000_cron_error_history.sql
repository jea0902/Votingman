-- 크론 실패 이력 (job당 마지막만 저장되는 cron_error_log 보완)
-- 실패할 때마다 1건 INSERT → 관리자 페이지에서 "최근 실패 모두" 조회 가능

CREATE TABLE IF NOT EXISTS public.cron_error_history (
  id bigserial PRIMARY KEY,
  job_name text NOT NULL,
  error_code text NOT NULL,
  error_message text NOT NULL,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cron_error_history IS '크론 실패 이력 (최근 N건 조회용). cron_error_log는 job별 마지막 1건만 유지';

CREATE INDEX IF NOT EXISTS idx_cron_error_history_created_at
  ON public.cron_error_history (created_at DESC);

ALTER TABLE public.cron_error_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No anon access"
  ON public.cron_error_history
  FOR ALL
  USING (false)
  WITH CHECK (false);
