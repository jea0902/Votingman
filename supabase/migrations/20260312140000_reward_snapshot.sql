-- 월말 22:00 KST 스냅샷: user_stats MMR TOP 10 저장
-- 해당 스냅샷에 있는 유저만 보상 신청 가능 (다음날 10:00 KST까지)

CREATE TABLE IF NOT EXISTS public.reward_snapshot (
  period text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  rank integer NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reward_snapshot_period ON public.reward_snapshot(period);

COMMENT ON TABLE public.reward_snapshot IS '월말 22:00 KST 스냅샷. user_stats MMR TOP 10. 이 스냅샷에 있는 유저만 보상 신청 가능';
COMMENT ON COLUMN public.reward_snapshot.period IS '스냅샷 대상 월 (YYYY-MM)';
COMMENT ON COLUMN public.reward_snapshot.rank IS '스냅샷 시점 순위 (1~10)';

ALTER TABLE public.reward_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access" ON public.reward_snapshot
  FOR ALL
  USING (false);
