-- =============================================
-- 002: 보팅맨 1단계 DB 확장 (배팅 금액, 폴 코인 집계·시장 구분, 정산 이력)
-- 실행 순서: Supabase SQL Editor에서 001 적용 후 본 파일 실행
-- =============================================

-- ---------------------------------------------
-- 1.2 sentiment_votes: bet_amount 추가 (배팅한 보팅코인 수)
-- ---------------------------------------------
ALTER TABLE public.sentiment_votes
  ADD COLUMN IF NOT EXISTS bet_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.sentiment_votes.bet_amount IS '배팅한 보팅코인 수 (소수 둘째자리, 최소 10코인)';

-- ---------------------------------------------
-- 1.3 sentiment_polls: 코인 집계·시장 구분 컬럼 추가
-- ---------------------------------------------
ALTER TABLE public.sentiment_polls
  ADD COLUMN IF NOT EXISTS long_coin_total NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_coin_total NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market TEXT;

COMMENT ON COLUMN public.sentiment_polls.long_coin_total IS '롱 쪽 베팅 코인 합 (집계 캐시)';
COMMENT ON COLUMN public.sentiment_polls.short_coin_total IS '숏 쪽 베팅 코인 합 (집계 캐시)';
COMMENT ON COLUMN public.sentiment_polls.market IS '시장 구분: btc, ndq, sp500, kospi, kosdaq 등. null 또는 기존 단일 폴은 btc';

-- 기존 행에 market 설정 (같은 날짜·시장 유일 제약 전에 필요)
UPDATE public.sentiment_polls SET market = 'btc' WHERE market IS NULL;

-- ---------------------------------------------
-- 1.5 sentiment_polls: (poll_date) unique → (poll_date, market) unique
-- ---------------------------------------------
ALTER TABLE public.sentiment_polls
  DROP CONSTRAINT IF EXISTS sentiment_polls_poll_date_unique;

ALTER TABLE public.sentiment_polls
  ADD CONSTRAINT sentiment_polls_poll_date_market_unique UNIQUE (poll_date, market);

-- ---------------------------------------------
-- 1.4 정산 이력 테이블: payout_history
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL,
    user_id UUID NOT NULL,
    market TEXT,
    bet_amount NUMERIC(10, 2) NOT NULL,
    payout_amount NUMERIC(10, 2) NOT NULL,
    settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT payout_history_pkey PRIMARY KEY (id),
    CONSTRAINT payout_history_poll_id_fkey FOREIGN KEY (poll_id)
        REFERENCES public.sentiment_polls(id) ON DELETE CASCADE,
    CONSTRAINT payout_history_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users(user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.payout_history IS '보팅맨 정산 이력: 폴당 당첨자별 수령 코인 (승률·티어·랭킹 계산용)';
COMMENT ON COLUMN public.payout_history.poll_id IS '정산된 폴 ID';
COMMENT ON COLUMN public.payout_history.user_id IS '당첨자 user_id';
COMMENT ON COLUMN public.payout_history.market IS '시장 구분 (btc, ndq 등)';
COMMENT ON COLUMN public.payout_history.bet_amount IS '해당 폴에서 해당 유저가 걸었던 코인 수';
COMMENT ON COLUMN public.payout_history.payout_amount IS '정산으로 수령한 코인 수';

CREATE INDEX IF NOT EXISTS idx_payout_history_poll ON public.payout_history(poll_id);
CREATE INDEX IF NOT EXISTS idx_payout_history_user ON public.payout_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_history_settled_at ON public.payout_history(settled_at);

ALTER TABLE public.payout_history ENABLE ROW LEVEL SECURITY;

-- payout_history: 서버(정산 job)만 INSERT, 본인/관리만 SELECT 등 정책은 운영에서 추가
CREATE POLICY "Users can view own payout history"
    ON public.payout_history FOR SELECT
    USING (user_id = auth.uid());
