-- 크론 실패 시 마지막 에러 저장 (모니터/디버깅용)
-- 서버리스에서 응답 본문을 볼 수 없을 때 대시보드에서 조회

CREATE TABLE IF NOT EXISTS public.cron_error_log (
  job_name text PRIMARY KEY,
  error_code text NOT NULL,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cron_error_log IS '크론 job별 마지막 실패 에러 (모니터 API에서 조회)';

-- RLS: anon 차단. API는 createSupabaseAdmin()(service_role)로 접근하므로 RLS 우회
ALTER TABLE public.cron_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No anon access"
  ON public.cron_error_log
  FOR ALL
  USING (false)
  WITH CHECK (false);
