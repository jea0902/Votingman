-- 크론 실패 시 context(시도한 candle_start_at 등) 저장 — 복구용
ALTER TABLE public.cron_error_log
  ADD COLUMN IF NOT EXISTS context jsonb;

COMMENT ON COLUMN public.cron_error_log.context IS '실패 시점 정보: market, candle_start_at 등 (복구 시 참고)';
