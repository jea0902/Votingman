-- =============================================
-- 006: 통합 랭킹 - user_season_stats에 market='all' 허용
-- 실행 순서: 004 적용 후 본 파일 실행
-- =============================================
-- 통합 랭킹: MMR·티어·배치 5판은 시장 구분 없이 market='all' 한 행만 사용.
-- sentiment_polls·payout_history는 btc/ndq/sp500/kospi/kosdaq 유지.

ALTER TABLE public.user_season_stats
  DROP CONSTRAINT IF EXISTS user_season_stats_market_check;

ALTER TABLE public.user_season_stats
  ADD CONSTRAINT user_season_stats_market_check
  CHECK (market IN ('btc', 'us', 'kr', 'all'));

COMMENT ON COLUMN public.user_season_stats.market IS '시장: btc, us, kr (레거시) 또는 all (통합 랭킹). 통합 랭킹은 all만 사용.';
