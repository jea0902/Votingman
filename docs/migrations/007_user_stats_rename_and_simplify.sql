-- =============================================
-- 007: user_season_stats → user_stats 리네임 및 컬럼 단순화
-- 실행 순서: 004, 006 적용 후 본 파일 실행
-- =============================================
-- 변경 요약:
--   - 테이블명: user_season_stats → user_stats
--   - 삭제 컬럼: season_id, placement_matches_played, placement_done, prev_season_mmr, tier
--   - 리네임: season_win_count → win_count, season_total_count → participation_count
--   - (user_id, market) 당 1행만 유지 (기존에는 시즌별 다행). 현재 시즌(season_id 최대) 행만 이전.
--   - mmr: 기존 0이어도 보유 코인 × 누적 승률로 재계산하여 채움
-- =============================================

-- 1) 새 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_stats (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    market TEXT NOT NULL,
    win_count INTEGER NOT NULL DEFAULT 0,
    participation_count INTEGER NOT NULL DEFAULT 0,
    mmr NUMERIC(20, 4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT user_stats_pkey PRIMARY KEY (id),
    CONSTRAINT user_stats_user_market_unique UNIQUE (user_id, market),
    CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users(user_id) ON DELETE CASCADE,
    CONSTRAINT user_stats_market_check CHECK (market IN ('btc', 'us', 'kr', 'all'))
);

COMMENT ON TABLE public.user_stats IS '보팅맨 시장별 통계: 승수, 참여 횟수, MMR (보유 코인 × 누적 승률)';
COMMENT ON COLUMN public.user_stats.market IS '시장: all (통합 랭킹), btc, us, kr (레거시)';
COMMENT ON COLUMN public.user_stats.win_count IS '당첨 횟수 (무효판 제외)';
COMMENT ON COLUMN public.user_stats.participation_count IS '참여한 총 횟수 (정산된 폴 중 참여 횟수, 무효판 제외)';
COMMENT ON COLUMN public.user_stats.mmr IS 'MMR = 보유 코인 × (win_count / participation_count)';

CREATE INDEX IF NOT EXISTS idx_user_stats_user ON public.user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_market_mmr ON public.user_stats(market, mmr DESC);

-- 2) 기존 데이터 이전: (user_id, market)당 season_id가 가장 큰 행 1개만 사용, mmr은 보유 코인×승률로 계산
INSERT INTO public.user_stats (user_id, market, win_count, participation_count, mmr, updated_at)
SELECT
    u.user_id,
    u.market,
    u.season_win_count,
    u.season_total_count,
    ROUND(
        COALESCE((SELECT voting_coin_balance::numeric FROM public.users WHERE user_id = u.user_id AND deleted_at IS NULL), 0)
        * CASE WHEN u.season_total_count > 0 THEN (u.season_win_count::numeric / u.season_total_count) ELSE 0 END,
        4
    ),
    u.updated_at
FROM public.user_season_stats u
INNER JOIN (
    SELECT user_id, market, MAX(season_id) AS season_id
    FROM public.user_season_stats
    GROUP BY user_id, market
) latest ON u.user_id = latest.user_id AND u.market = latest.market AND u.season_id = latest.season_id
ON CONFLICT (user_id, market) DO NOTHING;

-- 3) RLS 활성화 및 정책
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stats"
    ON public.user_stats FOR SELECT
    USING (user_id = auth.uid());

-- 4) 구 테이블 삭제
DROP TABLE IF EXISTS public.user_season_stats;
