-- =============================================
-- 인간 지표(데일리 투표) DB 테이블 및 RLS
-- 설계: docs/human-indicator-db-design.md
-- Supabase Dashboard → SQL Editor에서 실행 (한 번만 실행)
-- 이미 테이블이 있으면 sentiment_polls / sentiment_votes 먼저 DROP 후 실행
-- =============================================

-- =============================================
-- 1. sentiment_polls (일별 투표 마스터, 1일 1행)
-- =============================================

CREATE TABLE public.sentiment_polls (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    poll_date DATE NOT NULL,
    market TEXT,
    btc_open NUMERIC(20, 2),
    btc_close NUMERIC(20, 2),
    btc_change_pct NUMERIC(10, 4),
    long_count INTEGER NOT NULL DEFAULT 0,
    short_count INTEGER NOT NULL DEFAULT 0,
    long_coin_total NUMERIC(20, 2) NOT NULL DEFAULT 0,
    short_coin_total NUMERIC(20, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT sentiment_polls_pkey PRIMARY KEY (id),
    CONSTRAINT sentiment_polls_poll_date_market_unique UNIQUE (poll_date, market)
);

COMMENT ON TABLE public.sentiment_polls IS '인간 지표 일별 투표 마스터 (KST 기준 poll_date, 시장별 폴)';
COMMENT ON COLUMN public.sentiment_polls.poll_date IS '투표 대상일 (KST 기준 YYYY-MM-DD)';
COMMENT ON COLUMN public.sentiment_polls.market IS '시장: btc, ndq, sp500, kospi, kosdaq 등';
COMMENT ON COLUMN public.sentiment_polls.btc_open IS '당일 시가 (USD, 비트코인 등)';
COMMENT ON COLUMN public.sentiment_polls.btc_close IS '당일 종가 (USD)';
COMMENT ON COLUMN public.sentiment_polls.long_count IS '롱 투표 수 (집계 캐시)';
COMMENT ON COLUMN public.sentiment_polls.short_count IS '숏 투표 수 (집계 캐시)';
COMMENT ON COLUMN public.sentiment_polls.long_coin_total IS '롱 쪽 베팅 코인 합';
COMMENT ON COLUMN public.sentiment_polls.short_coin_total IS '숏 쪽 베팅 코인 합';


-- =============================================
-- 2. sentiment_votes (개별 투표, 1투표 1행)
-- =============================================

CREATE TABLE public.sentiment_votes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL,
    user_id UUID,
    anonymous_id TEXT,
    choice TEXT NOT NULL,
    bet_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT sentiment_votes_pkey PRIMARY KEY (id),
    CONSTRAINT sentiment_votes_poll_id_fkey FOREIGN KEY (poll_id)
        REFERENCES public.sentiment_polls(id) ON DELETE CASCADE,
    CONSTRAINT sentiment_votes_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT sentiment_votes_choice_check CHECK (choice IN ('long', 'short'))
);

COMMENT ON TABLE public.sentiment_votes IS '인간 지표 개별 투표 (1인 1폴 1행, choice + bet_amount)';
COMMENT ON COLUMN public.sentiment_votes.anonymous_id IS '비로그인 시 쿠키 UUID (현재 로그인 전제로 미사용)';
COMMENT ON COLUMN public.sentiment_votes.bet_amount IS '배팅한 보팅코인 수 (소수 둘째자리)';

-- 1인 1투표: 로그인 유저는 (poll_id, user_id) 당 1행
CREATE UNIQUE INDEX sentiment_votes_unique_user
    ON public.sentiment_votes (poll_id, user_id)
    WHERE user_id IS NOT NULL;

-- 1인 1투표: 비로그인은 (poll_id, anonymous_id) 당 1행
CREATE UNIQUE INDEX sentiment_votes_unique_anonymous
    ON public.sentiment_votes (poll_id, anonymous_id)
    WHERE anonymous_id IS NOT NULL;

-- 투표·집계 조회용 인덱스
CREATE INDEX idx_sentiment_votes_poll ON public.sentiment_votes(poll_id);
CREATE INDEX idx_sentiment_votes_user ON public.sentiment_votes(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_sentiment_polls_poll_date ON public.sentiment_polls(poll_date);


-- =============================================
-- 3. RLS 활성화 및 정책
-- =============================================

ALTER TABLE public.sentiment_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentiment_votes ENABLE ROW LEVEL SECURITY;

-- sentiment_polls: 전체 공개 조회, 수정은 서버(service_role)만
CREATE POLICY "Anyone can view sentiment_polls"
    ON public.sentiment_polls FOR SELECT
    USING (true);

-- sentiment_polls INSERT/UPDATE/DELETE는 정책 없음 → service_role만 가능 (API에서 사용)

-- sentiment_votes: 누구나 INSERT (비로그인은 anonymous_id, 로그인은 user_id)
CREATE POLICY "Anyone can insert own vote"
    ON public.sentiment_votes FOR INSERT
    WITH CHECK (
        (user_id IS NULL AND anonymous_id IS NOT NULL)
        OR (user_id = auth.uid())
    );

-- 본인 투표만 SELECT (맞출 확률 등 조회 시)
CREATE POLICY "Users can view own votes"
    ON public.sentiment_votes FOR SELECT
    USING (user_id = auth.uid());

-- 본인 투표만 UPDATE (롱↔숏 수정)
CREATE POLICY "Users can update own vote"
    ON public.sentiment_votes FOR UPDATE
    USING (user_id = auth.uid());

-- 비로그인은 SELECT/UPDATE 불가 → 중복 투표 여부·수정은 API(service_role)에서 처리


-- =============================================
-- 4. (선택) updated_at 자동 갱신 트리거
-- =============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sentiment_polls_updated_at
    BEFORE UPDATE ON public.sentiment_polls
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();


-- =============================================
-- 4. payout_history (정산 이력, 당첨자별 수령 코인)
-- =============================================

CREATE TABLE public.payout_history (
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

COMMENT ON TABLE public.payout_history IS '보팅맨 정산 이력 (승률·티어·랭킹 계산용)';
CREATE INDEX idx_payout_history_poll ON public.payout_history(poll_id);
CREATE INDEX idx_payout_history_user ON public.payout_history(user_id);
CREATE INDEX idx_payout_history_settled_at ON public.payout_history(settled_at);

ALTER TABLE public.payout_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payout history"
    ON public.payout_history FOR SELECT
    USING (user_id = auth.uid());


-- =============================================
-- 실행 후 확인
-- =============================================
-- SELECT * FROM public.sentiment_polls;
-- SELECT * FROM public.sentiment_votes;
-- SELECT * FROM public.payout_history;
