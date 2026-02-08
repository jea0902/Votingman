-- =============================================
-- 007: sentiment_votes에 market 컬럼 추가
-- 실행 순서: 002 적용 후 본 파일 실행
-- =============================================
-- 어느 시장 폴에 대한 투표인지 저장. TOP5 "최다배팅 시장" 집계·시장별 통계에 필요.

ALTER TABLE public.sentiment_votes
  ADD COLUMN IF NOT EXISTS market TEXT;

COMMENT ON COLUMN public.sentiment_votes.market IS '시장 구분: btc, ndq, sp500, kospi, kosdaq. 투표 시 해당 폴(sentiment_polls.market) 값 저장.';

-- 기존 행 backfill: poll_id로 sentiment_polls와 조인해 market 채우기
UPDATE public.sentiment_votes v
SET market = p.market
FROM public.sentiment_polls p
WHERE v.poll_id = p.id
  AND v.market IS NULL
  AND p.market IS NOT NULL;

-- 이후 미채워진 행은 btc로 둠 (레거시 단일 시장 가정)
UPDATE public.sentiment_votes SET market = 'btc' WHERE market IS NULL;
