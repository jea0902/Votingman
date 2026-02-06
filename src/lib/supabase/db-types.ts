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
  pass_reason: string | null;  // JSON 형태로 상세 지표 포함
  valuation_reason: string | null;  // JSON 형태로 적정가 분석 포함
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
  industry: string | null;  // 산업 섹터
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
  pass_reason: string | null;  // JSON 형태로 상세 지표 포함
  valuation_reason: string | null;  // JSON 형태로 적정가 분석 포함
  created_at: string | null;
};

/** pass_reason JSON 파싱 결과 타입 */
export type PassReasonData = {
  summary: string;
  passed: boolean;
  scores: {
    roe: number;
    roic: number;
    margin: number;
    trend: number;
    health: number;
    cash: number;
  };
  values: {
    avg_roe: number;
    avg_roic: number;
    avg_net_margin: number;
    avg_fcf_margin: number;
    debt_ratio: number;
  };
  highlights: string[];
};

/** valuation_reason JSON 파싱 결과 타입 */
export type ValuationReasonData = {
  eps_cagr: number;
  applied_per: number;
  per_label: string;
  current_price: number;
  intrinsic_value: number;
  gap_pct: number;
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
  /** 보팅맨 보팅코인 잔액 (DB: voting_coin_balance, 기존 virtual_cash_balance에서 이름 변경). select 시에만 존재 */
  voting_coin_balance?: number;
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

// =========================================
// 인간 지표 (데일리 투표)
// =========================================

/** sentiment_polls: 일별 투표 마스터 (KST poll_date, 시장별 폴) */
export type SentimentPollRow = {
  id: string;
  poll_date: string;
  market: string | null;
  btc_open: number | null;
  btc_close: number | null;
  btc_change_pct: number | null;
  long_count: number;
  short_count: number;
  long_coin_total: number;
  short_coin_total: number;
  created_at: string;
  updated_at: string;
  /** 정산 완료 시각 (재실행 방지). NULL이면 미정산 */
  settled_at?: string | null;
};

/** sentiment_votes: 개별 투표 (choice + bet_amount) */
export type SentimentVoteRow = {
  id: string;
  poll_id: string;
  user_id: string | null;
  anonymous_id: string | null;
  choice: 'long' | 'short';
  bet_amount: number;
  created_at: string;
};

/** payout_history: 정산 이력 (당첨자별 수령 코인) */
export type PayoutHistoryRow = {
  id: string;
  poll_id: string;
  user_id: string;
  market: string | null;
  bet_amount: number;
  payout_amount: number;
  settled_at: string;
};

// =========================================
// 7단계: 시장별 시즌 통계·MMR·티어
// =========================================

/** 시장 그룹 (티어/MMR): btc | us | kr */
export type TierMarket = "btc" | "us" | "kr";

/** 티어 (배치 완료자만) */
export type TierKey = "gold" | "platinum" | "diamond" | "master" | "challenger";

/** user_season_stats: 시장별 시즌 통계 */
export type UserSeasonStatsRow = {
  id: string;
  user_id: string;
  market: TierMarket;
  season_id: string;
  placement_matches_played: number;
  placement_done: boolean;
  season_win_count: number;
  season_total_count: number;
  mmr: number;
  prev_season_mmr: number | null;
  tier: TierKey | null;
  updated_at: string;
};
