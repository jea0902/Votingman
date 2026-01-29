/**
 * DDL 기반 DB 타입 정의
 * - public.buffett_run, buffett_result, stocks, latest_price 등 스키마와 1:1 매칭
 */

/** buffett_run: 평가 스냅샷 버전. CHECK(universe IN ('SP500','NASDAQ100','ALL')) */
export type BuffettRun = {
  run_id: number;
  run_date: string;
  data_version: string;
  universe: string;
  data_source: string;
};

/** buffett_result: 버핏 원픽 결과 (카드/모달용). CHECK(pass_status IN ('PASS','FAIL')), recommendation IN ('BUY','WAIT'), trust_grade IN (1,2,3) */
export type BuffettResultRow = {
  run_id: number;
  stock_id: number;
  total_score: number | null;
  pass_status: string | null;
  current_price: number | null;
  intrinsic_value: number | null;
  gap_pct: number | null;
  recommendation: string | null;
  is_undervalued: boolean | null;
  years_data: number | null;
  trust_grade: number | null;
  trust_grade_text: string | null;
  trust_grade_stars: string | null;
  pass_reason: string | null;
  valuation_reason: string | null;
  created_at: string | null;
};

/** stocks: 미국 주식 마스터 (조인 시 사용) */
export type StockRow = {
  stock_id: number;
  ticker: string;
  company_name: string;
  exchange: string | null;
  industry: string | null;
  created_at: string | null;
};

/** latest_price: 일간 최신가 (조인 시 price_date 등) */
export type LatestPriceRow = {
  stock_id: number;
  price_date: string;
  current_price: number;
  updated_at: string | null;
};

/** buffett_result + stocks + latest_price 조인 결과 (API 내부용) */
export type BuffettResultWithRelations = BuffettResultRow & {
  stocks: (Pick<StockRow, "ticker" | "company_name"> & {
    latest_price: Pick<LatestPriceRow, "price_date"> | null;
  }) | null;
};

/** API 응답용 버핏 카드 한 건 */
export type BuffettCardResponse = {
  run_id: number;
  stock_id: number;
  ticker: string | null;
  company_name: string | null;
  current_price: number | null;
  price_date: string | null;
  total_score: number | null;
  pass_status: string | null;
  intrinsic_value: number | null;
  gap_pct: number | null;
  recommendation: string | null;
  is_undervalued: boolean | null;
  years_data: number | null;
  trust_grade: number | null;
  trust_grade_text: string | null;
  trust_grade_stars: string | null;
  pass_reason: string | null;
  valuation_reason: string | null;
  created_at: string | null;
};
