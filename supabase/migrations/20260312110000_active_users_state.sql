-- 일별 활성 유저·투표 집계 (KST 23:59 크론으로 매일 저장)
-- users.last_active_at, sentiment_votes.created_at 기준 KST 일별 집계

CREATE TABLE IF NOT EXISTS public.active_users_state (
  stat_date date PRIMARY KEY,
  active_user_count integer NOT NULL DEFAULT 0,
  vote_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_active_users_state_stat_date ON public.active_users_state(stat_date DESC);

COMMENT ON TABLE public.active_users_state IS '일별 활성 유저 수·투표 수 집계. KST 23:59 크론으로 매일 저장';
COMMENT ON COLUMN public.active_users_state.stat_date IS 'KST 기준 집계 날짜 (YYYY-MM-DD)';
COMMENT ON COLUMN public.active_users_state.active_user_count IS '해당 날짜 last_active_at 기준 활성 유저 수 (deleted_at 제외)';
COMMENT ON COLUMN public.active_users_state.vote_count IS '해당 날짜 created_at 기준 sentiment_votes 건수';

-- RLS: 관리자 API에서 createSupabaseAdmin 사용 → RLS 우회
ALTER TABLE public.active_users_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access" ON public.active_users_state
  FOR ALL
  USING (false);
