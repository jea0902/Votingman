-- ============================================================
-- buffett_result 테이블에 상세 지표 컬럼 추가
-- 
-- 목적:
-- - 우량주 평가에 사용된 개별 지표 점수 저장
-- - 실제 지표 값 저장 (ROE, ROIC, Net Margin 등)
-- - 모달에서 상세 평가 근거 표시 가능
-- 
-- 실행: Supabase SQL Editor에서 실행
-- ============================================================

-- 1. 개별 점수 컬럼 추가 (총점의 세부 내역)
ALTER TABLE public.buffett_result 
  ADD COLUMN IF NOT EXISTS roe_score NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS roic_score NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS margin_score NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trend_score NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS health_score NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cash_score NUMERIC(5,2) DEFAULT NULL;

-- 2. 실제 지표 값 컬럼 추가
ALTER TABLE public.buffett_result 
  ADD COLUMN IF NOT EXISTS avg_roe NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avg_roic NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avg_net_margin NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avg_fcf_margin NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS debt_ratio NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS eps_cagr NUMERIC(8,2) DEFAULT NULL;

-- 3. 컬럼 설명 추가
COMMENT ON COLUMN public.buffett_result.roe_score IS 'ROE 지속성 점수 (25점 만점)';
COMMENT ON COLUMN public.buffett_result.roic_score IS 'ROIC 지속성 점수 (20점 만점)';
COMMENT ON COLUMN public.buffett_result.margin_score IS 'Net Margin 안정성 점수 (15점 만점)';
COMMENT ON COLUMN public.buffett_result.trend_score IS '수익성 추세 점수 (15점 만점)';
COMMENT ON COLUMN public.buffett_result.health_score IS '재무 건전성 점수 (15점 만점)';
COMMENT ON COLUMN public.buffett_result.cash_score IS '현금창출력 점수 (10점 만점)';

COMMENT ON COLUMN public.buffett_result.avg_roe IS '평균 ROE (%)';
COMMENT ON COLUMN public.buffett_result.avg_roic IS '평균 ROIC (%)';
COMMENT ON COLUMN public.buffett_result.avg_net_margin IS '평균 순이익률 (%)';
COMMENT ON COLUMN public.buffett_result.avg_fcf_margin IS '평균 FCF 마진 (%)';
COMMENT ON COLUMN public.buffett_result.debt_ratio IS '부채비율 (%)';
COMMENT ON COLUMN public.buffett_result.eps_cagr IS 'EPS 연평균 성장률 (%)';

-- ============================================================
-- 검증 쿼리
-- ============================================================
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'buffett_result' 
-- ORDER BY ordinal_position;
