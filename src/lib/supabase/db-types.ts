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
  // 개별 점수 (총점 세부 내역)
  roe_score: number | null;
  roic_score: number | null;
  margin_score: number | null;
  trend_score: number | null;
  health_score: number | null;
  cash_score: number | null;
  // 실제 지표 값
  avg_roe: number | null;
  avg_roic: number | null;
  avg_net_margin: number | null;
  avg_fcf_margin: number | null;
  debt_ratio: number | null;
  eps_cagr: number | null;
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
  // 개별 점수 (총점 세부 내역)
  roe_score: number | null;
  roic_score: number | null;
  margin_score: number | null;
  trend_score: number | null;
  health_score: number | null;
  cash_score: number | null;
  // 실제 지표 값
  avg_roe: number | null;
  avg_roic: number | null;
  avg_net_margin: number | null;
  avg_fcf_margin: number | null;
  debt_ratio: number | null;
  eps_cagr: number | null;
};

// =========================================
// 커뮤니티 게시판 타입
// =========================================

/** users: 사용자 프로필 */
export type UserRow = {
  user_id: string;
  email: string;
  nickname: string;
  profile_image: string | null;
  role: string;
  allow_notif_tn: string;
  allow_notif_bo: string;
  created_at: string;
  deleted_at: string | null;
};

/** board_posts: 게시글 */
export type BoardPostRow = {
  post_id: number;
  user_id: string;
  board_type: 'free' | 'perspective';
  category: 'free' | 'suggestion' | null;
  title: string;
  content: string;
  author_name: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  is_pinned: boolean;
  is_admin_post: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** board_comments: 댓글 */
export type BoardCommentRow = {
  comment_id: number;
  post_id: number;
  user_id: string;
  content: string;
  author_name: string;
  parent_comment_id: number | null;
  depth: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** board_images: 게시글 첨부 이미지 */
export type BoardImageRow = {
  image_id: number;
  post_id: number;
  image_url: string;
  sort_order: number;
};

/** API 요청: 게시글 작성 */
export type CreatePostRequest = {
  board_type: 'free' | 'perspective';
  category?: 'free' | 'suggestion';
  title: string;
  content: string;
  author_name: string; // 임시: 인증 전에는 수동 입력
};

/** API 요청: 게시글 수정 */
export type UpdatePostRequest = {
  title?: string;
  content?: string;
  category?: 'free' | 'suggestion';
};

/** API 응답: 게시글 목록 아이템 */
export type PostListItem = {
  post_id: number;
  board_type: 'free' | 'perspective';
  category: 'free' | 'suggestion' | null;
  title: string;
  author_name: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  is_pinned: boolean;
  is_admin_post: boolean;
  created_at: string;
};

/** API 응답: 게시글 상세 */
export type PostDetailResponse = BoardPostRow;

/** API 응답: 게시글 목록 (페이지네이션) */
export type PostListResponse = {
  posts: PostListItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
};
