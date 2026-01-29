-- ============================================================
-- 완전한 API 테스트를 위한 테스트 데이터 삽입 스크립트
-- 실행 순서: stocks → buffett_result → latest_price
-- ============================================================

-- 1. stocks 테이블에 테스트 종목 삽입 (stock_id 자동 생성)
INSERT INTO public.stocks (ticker, company_name, exchange, industry)
VALUES 
  ('AAPL', 'Apple Inc.', 'NASDAQ', 'Technology'),
  ('MSFT', 'Microsoft Corporation', 'NASDAQ', 'Technology'),
  ('GOOGL', 'Alphabet Inc.', 'NASDAQ', 'Technology')
RETURNING stock_id, ticker;

-- 2. buffett_result 테이블에 run_id=1 결과 삽입
-- 주의: 위에서 생성된 stock_id를 사용해야 함
-- (실제로는 위 쿼리 결과의 stock_id를 확인 후 아래 값들을 수정해야 함)
-- 예시: stock_id가 1, 2, 3으로 생성되었다고 가정

INSERT INTO public.buffett_result (
  run_id,
  stock_id,
  total_score,
  pass_status,
  current_price,
  intrinsic_value,
  gap_pct,
  recommendation,
  is_undervalued,
  years_data,
  trust_grade,
  trust_grade_text,
  trust_grade_stars,
  pass_reason,
  valuation_reason
)
VALUES 
  -- 종목 1: Apple (PASS, BUY, 저평가)
  (
    1,                    -- run_id (buffett_run에서 생성한 값)
    (SELECT stock_id FROM public.stocks WHERE ticker = 'AAPL'),  -- stock_id
    88.5,                 -- total_score
    'PASS',               -- pass_status
    185.50,               -- current_price
    220.00,               -- intrinsic_value
    18.6,                 -- gap_pct
    'BUY',                -- recommendation
    true,                 -- is_undervalued
    5,                    -- years_data
    1,                    -- trust_grade
    '1등급',              -- trust_grade_text
    '★★★★★',            -- trust_grade_stars
    'ROE 지속성 우수, 재무 건전성 강함',  -- pass_reason
    'DCF 모델 기반 적정가 산정'           -- valuation_reason
  ),
  -- 종목 2: Microsoft (PASS, BUY, 저평가)
  (
    1,
    (SELECT stock_id FROM public.stocks WHERE ticker = 'MSFT'),
    92.0,
    'PASS',
    420.30,
    480.00,
    14.2,
    'BUY',
    true,
    5,
    1,
    '1등급',
    '★★★★★',
    'ROE/ROIC 지속성 우수, 클라우드 성장세',
    'DCF 모델 + 상대가치법 기반'
  ),
  -- 종목 3: Google (PASS, WAIT, 적정가)
  (
    1,
    (SELECT stock_id FROM public.stocks WHERE ticker = 'GOOGL'),
    75.5,
    'PASS',
    150.20,
    155.00,
    3.2,
    'WAIT',
    false,
    4,
    2,
    '2등급',
    '★★★★☆',
    'ROE 양호하나 데이터 연수 부족',
    'DCF 모델 기반'
  );

-- 3. latest_price 테이블에 최신가 삽입
INSERT INTO public.latest_price (stock_id, price_date, current_price)
VALUES 
  (
    (SELECT stock_id FROM public.stocks WHERE ticker = 'AAPL'),
    '2025-01-28',
    185.50
  ),
  (
    (SELECT stock_id FROM public.stocks WHERE ticker = 'MSFT'),
    '2025-01-28',
    420.30
  ),
  (
    (SELECT stock_id FROM public.stocks WHERE ticker = 'GOOGL'),
    '2025-01-28',
    150.20
  )
ON CONFLICT (stock_id) 
DO UPDATE SET 
  price_date = EXCLUDED.price_date,
  current_price = EXCLUDED.current_price,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================
-- 검증 쿼리 (삽입 확인용)
-- ============================================================
-- SELECT * FROM public.stocks WHERE ticker IN ('AAPL', 'MSFT', 'GOOGL');
-- SELECT * FROM public.buffett_result WHERE run_id = 1;
-- SELECT * FROM public.latest_price WHERE stock_id IN (SELECT stock_id FROM public.stocks WHERE ticker IN ('AAPL', 'MSFT', 'GOOGL'));
