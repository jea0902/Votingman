"use client";

/**
 * BuffettCard - 버핏원픽 평가 결과 카드
 *
 * 설계 의도:
 * - DB에서 가져온 버핏 평가 결과를 표시
 * - 황금색 카드: 우량주 + 저평가 (PASS + BUY)
 * - 빨간색 카드: 우량주 (PASS + WAIT)
 * - 회색 카드: 미통과 (FAIL)
 * - 호버 시 살짝 확대 효과
 * - 클릭 시 평가 상세 모달 (지표별 점수 + 실제 값)
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { 
  BuffettCardResponse, 
  PassReasonData, 
  ValuationReasonData 
} from "@/lib/supabase/db-types";

/**
 * S&P500 + NASDAQ100 주요 종목 한글명 매핑
 */
const KOREAN_NAMES: Record<string, string> = {
  // === 빅테크 (Magnificent 7) ===
  AAPL: "애플",
  MSFT: "마이크로소프트",
  GOOGL: "알파벳 A",
  GOOG: "알파벳 C",
  AMZN: "아마존",
  META: "메타",
  NVDA: "엔비디아",
  TSLA: "테슬라",

  // === 반도체 ===
  AMD: "AMD",
  INTC: "인텔",
  AVGO: "브로드컴",
  QCOM: "퀄컴",
  TXN: "텍사스인스트루먼트",
  MU: "마이크론",
  AMAT: "어플라이드머티리얼즈",
  LRCX: "램리서치",
  KLAC: "KLA",
  ADI: "아날로그디바이스",
  MRVL: "마벨테크놀로지",
  NXPI: "NXP반도체",
  ASML: "ASML",
  ARM: "ARM",
  MCHP: "마이크로칩",
  ON: "온세미컨덕터",
  SWKS: "스카이웍스",

  // === 소프트웨어 & 클라우드 ===
  CRM: "세일즈포스",
  ADBE: "어도비",
  ORCL: "오라클",
  IBM: "IBM",
  NOW: "서비스나우",
  SNOW: "스노우플레이크",
  PLTR: "팔란티어",
  PANW: "팔로알토네트웍스",
  CRWD: "크라우드스트라이크",
  ZS: "지스케일러",
  DDOG: "데이터독",
  WDAY: "워크데이",
  INTU: "인튜이트",
  ADSK: "오토데스크",
  SNPS: "시놉시스",
  CDNS: "케이던스",
  ANSS: "앤시스",
  TEAM: "아틀라시안",

  // === 인터넷 & 미디어 ===
  NFLX: "넷플릭스",
  DIS: "디즈니",
  CMCSA: "컴캐스트",
  WBD: "워너브라더스",
  PARA: "파라마운트",
  SPOT: "스포티파이",
  ROKU: "로쿠",
  PINS: "핀터레스트",
  SNAP: "스냅",
  UBER: "우버",
  LYFT: "리프트",
  ABNB: "에어비앤비",
  BKNG: "부킹홀딩스",
  EXPE: "익스피디아",
  MAR: "메리어트",
  HLT: "힐튼",

  // === 전자상거래 & 핀테크 ===
  PYPL: "페이팔",
  SQ: "블록",
  SHOP: "쇼피파이",
  EBAY: "이베이",
  ETSY: "엣시",
  MELI: "메르카도리브레",
  SE: "씨리미티드",
  COIN: "코인베이스",
  HOOD: "로빈후드",

  // === 금융 ===
  JPM: "JP모건",
  BAC: "뱅크오브아메리카",
  WFC: "웰스파고",
  C: "시티그룹",
  GS: "골드만삭스",
  MS: "모건스탠리",
  SCHW: "찰스슈왑",
  BLK: "블랙록",
  BX: "블랙스톤",
  KKR: "KKR",
  APO: "아폴로",
  V: "비자",
  MA: "마스터카드",
  AXP: "아메리칸익스프레스",
  COF: "캐피탈원",
  USB: "US뱅코프",
  PNC: "PNC파이낸셜",
  TFC: "트루이스트",
  "BRK-B": "버크셔해서웨이",

  // === 보험 ===
  BRK: "버크셔해서웨이",
  AIG: "AIG",
  MET: "메트라이프",
  PRU: "프루덴셜",
  AFL: "애플락",
  CB: "처브",
  TRV: "트래블러스",
  ALL: "올스테이트",
  PGR: "프로그레시브",

  // === 헬스케어 & 제약 ===
  JNJ: "존슨앤존슨",
  UNH: "유나이티드헬스",
  PFE: "화이자",
  MRK: "머크",
  ABBV: "애브비",
  LLY: "일라이릴리",
  TMO: "써모피셔",
  ABT: "애보트",
  DHR: "다나허",
  BMY: "브리스톨마이어스",
  AMGN: "암젠",
  GILD: "길리어드",
  VRTX: "버텍스",
  REGN: "리제네론",
  BIIB: "바이오젠",
  MRNA: "모더나",
  ISRG: "인튜이티브서지컬",
  EW: "에드워즈라이프",
  SYK: "스트라이커",
  BSX: "보스턴사이언티픽",
  MDT: "메드트로닉",
  ZBH: "짐머바이오멧",
  DXCM: "덱스콤",
  ILMN: "일루미나",
  ALNY: "알닐람",
  CVS: "CVS헬스",
  CI: "시그나",
  ELV: "엘리번스헬스",
  HUM: "휴마나",
  MCK: "맥케슨",
  CAH: "카디널헬스",

  // === 소비재 ===
  KO: "코카콜라",
  PEP: "펩시코",
  PG: "P&G",
  CL: "콜게이트팜올리브",
  KMB: "킴벌리클라크",
  EL: "에스티로더",
  COST: "코스트코",
  WMT: "월마트",
  TGT: "타겟",
  HD: "홈디포",
  LOW: "로우스",
  MCD: "맥도날드",
  SBUX: "스타벅스",
  CMG: "치폴레",
  DPZ: "도미노피자",
  YUM: "얌브랜즈",
  NKE: "나이키",
  LULU: "룰루레몬",
  TJX: "TJ맥스",
  ROST: "로스스토어스",
  DG: "달러제너럴",
  DLTR: "달러트리",
  KR: "크로거",
  SYY: "시스코푸드",

  // === 자동차 ===
  GM: "GM",
  F: "포드",
  RIVN: "리비안",
  LCID: "루시드",
  TM: "토요타",
  HMC: "혼다",

  // === 산업재 ===
  BA: "보잉",
  LMT: "록히드마틴",
  RTX: "RTX",
  NOC: "노스롭그루먼",
  GD: "제너럴다이나믹스",
  CAT: "캐터필러",
  DE: "디어",
  HON: "하니웰",
  MMM: "3M",
  GE: "GE에어로스페이스",
  UPS: "UPS",
  FDX: "페덱스",
  UNP: "유니온퍼시픽",
  CSX: "CSX",
  NSC: "노퍽서던",
  EMR: "에머슨일렉트릭",
  ETN: "이튼",
  ITW: "일리노이툴웍스",
  PH: "파커하니핀",
  ROK: "록웰오토메이션",
  WM: "웨이스트매니지먼트",
  RSG: "리퍼블릭서비스",

  // === 에너지 ===
  XOM: "엑슨모빌",
  CVX: "셰브론",
  COP: "코노코필립스",
  EOG: "EOG리소스",
  SLB: "슐럼버거",
  OXY: "옥시덴탈",
  PSX: "필립스66",
  MPC: "마라톤페트롤리엄",
  VLO: "발레로에너지",
  KMI: "킨더모건",
  WMB: "윌리엄스",
  OKE: "원오케이",

  // === 통신 ===
  VZ: "버라이즌",
  T: "AT&T",
  TMUS: "T모바일",

  // === 유틸리티 ===
  NEE: "넥스트에라에너지",
  DUK: "듀크에너지",
  SO: "서던컴퍼니",
  D: "도미니언에너지",
  AEP: "아메리칸일렉트릭",
  EXC: "엑셀론",
  SRE: "셈프라에너지",
  XEL: "엑셀에너지",
  CEG: "콘스텔레이션에너지",

  // === 부동산 (REITs) ===
  AMT: "아메리칸타워",
  PLD: "프롤로지스",
  CCI: "크라운캐슬",
  EQIX: "에퀴닉스",
  PSA: "퍼블릭스토리지",
  O: "리얼티인컴",
  SPG: "사이먼프로퍼티",
  WELL: "웰타워",
  AVB: "아발론베이",
  EQR: "에퀴티레지덴셜",

  // === 소재 ===
  LIN: "린데",
  APD: "에어프로덕츠",
  SHW: "셔윈윌리엄스",
  ECL: "에코랩",
  NEM: "뉴몬트",
  FCX: "프리포트맥모란",
  NUE: "뉴코어",
  CF: "CF인더스트리",
  MOS: "모자이크",
  ALB: "알버말",

  // === 기타 주요 종목 ===
  ANET: "아리스타네트웍스",
  CSCO: "시스코",
  HPQ: "HP",
  DELL: "델테크놀로지스",
  HPE: "HP엔터프라이즈",
  FTNT: "포티넷",
  AKAM: "아카마이",
  FFIV: "F5",
  JNPR: "주니퍼네트웍스",
  STX: "시게이트",
  WDC: "웨스턴디지털",
  NTAP: "넷앱",
  KEYS: "키사이트",
  TER: "테라다인",
  MPWR: "모노리틱파워",
  ENPH: "엔페이즈에너지",
  SEDG: "솔라엣지",
  FSLR: "퍼스트솔라",
  GEHC: "GE헬스케어",
  CHTR: "차터커뮤니케이션",
  LBRDK: "리버티브로드밴드",
  FWONK: "리버티포뮬러원",
  LYV: "라이브네이션",
  TTWO: "테이크투",
  EA: "일렉트로닉아츠",
  ATVI: "액티비전블리자드",
  ZM: "줌비디오",
  DOCU: "도큐사인",
  OKTA: "옥타",
  VEEV: "비바시스템스",
  SPLK: "스플렁크",
  MDB: "몽고DB",
  NET: "클라우드플레어",
  BILL: "빌닷컴",
  HUBS: "허브스팟",
  TTD: "트레이드데스크",
  RBLX: "로블록스",
  U: "유니티",
  DASH: "도어대시",
  DKNG: "드래프트킹스",
  PENN: "펜엔터테인먼트",
  MGM: "MGM리조트",
  LVS: "라스베가스샌즈",
  WYNN: "윈리조트",
  CCL: "카니발",
  RCL: "로열캐리비안",
  NCLH: "노르웨이크루즈",
  DAL: "델타항공",
  UAL: "유나이티드항공",
  LUV: "사우스웨스트항공",
  AAL: "아메리칸항공",
};

/**
 * 산업 섹터 영어-한글 매핑
 */
const INDUSTRY_KOREAN: Record<string, string> = {
  // 기술
  Technology: "기술",
  "Information Technology": "정보기술",
  Software: "소프트웨어",
  "Software—Infrastructure": "소프트웨어 인프라",
  "Software—Application": "소프트웨어 애플리케이션",
  Hardware: "하드웨어",
  "Computer Hardware": "컴퓨터 하드웨어",
  Semiconductors: "반도체",
  "Semiconductor Equipment & Materials": "반도체 장비",
  "Electronic Components": "전자부품",
  "Consumer Electronics": "가전제품",
  // 통신
  "Communication Services": "통신 서비스",
  "Communication Equipment": "통신 장비",
  Telecommunication: "통신",
  "Telecom Services": "통신 서비스",
  "Internet Content & Information": "인터넷 콘텐츠",
  // 금융
  "Financial Services": "금융 서비스",
  Financials: "금융",
  Banks: "은행",
  "Banks—Diversified": "다각화 은행",
  "Banks—Regional": "지역 은행",
  Insurance: "보험",
  "Insurance—Diversified": "다각화 보험",
  "Insurance—Life": "생명보험",
  "Insurance—Property & Casualty": "손해보험",
  "Asset Management": "자산운용",
  "Capital Markets": "자본시장",
  "Credit Services": "신용 서비스",
  // 헬스케어
  Healthcare: "헬스케어",
  "Health Care": "헬스케어",
  "Healthcare Plans": "의료보험",
  "Healthcare Providers & Services": "의료 서비스",
  Biotechnology: "바이오테크",
  Pharmaceuticals: "제약",
  "Drug Manufacturers—General": "의약품 제조",
  "Drug Manufacturers—Specialty & Generic": "특수의약품",
  "Medical Devices": "의료기기",
  "Medical Instruments & Supplies": "의료기기",
  "Diagnostics & Research": "진단 및 연구",
  // 소비재
  "Consumer Discretionary": "임의소비재",
  "Consumer Cyclical": "경기소비재",
  "Consumer Staples": "필수소비재",
  "Consumer Defensive": "방어적 소비재",
  Retail: "소매",
  "Specialty Retail": "전문 소매",
  "Internet Retail": "인터넷 소매",
  "Home Improvement Retail": "홈 인테리어",
  "Discount Stores": "할인점",
  "Department Stores": "백화점",
  "Grocery Stores": "식료품점",
  Restaurants: "레스토랑",
  "Beverages—Non-Alcoholic": "비알콜 음료",
  "Beverages—Soft Drinks": "청량음료",
  "Packaged Foods": "포장식품",
  "Household & Personal Products": "가정용품",
  "Apparel Manufacturing": "의류 제조",
  "Footwear & Accessories": "신발 및 액세서리",
  "Luxury Goods": "명품",
  // 산업재
  Industrials: "산업재",
  "Industrial Products": "산업제품",
  "Aerospace & Defense": "항공우주 및 방위",
  "Farm & Heavy Construction Machinery": "농업 및 건설기계",
  "Specialty Industrial Machinery": "특수산업기계",
  "Electrical Equipment & Parts": "전기장비",
  "Industrial Distribution": "산업유통",
  "Integrated Freight & Logistics": "물류",
  Railroads: "철도",
  Airlines: "항공",
  "Trucking": "트럭 운송",
  "Waste Management": "폐기물 관리",
  // 에너지
  Energy: "에너지",
  "Oil & Gas": "석유 및 가스",
  "Oil & Gas Integrated": "통합 석유",
  "Oil & Gas E&P": "석유 탐사",
  "Oil & Gas Refining & Marketing": "석유 정제",
  "Oil & Gas Equipment & Services": "석유 장비",
  "Oil & Gas Midstream": "석유 중류",
  // 유틸리티
  Utilities: "유틸리티",
  "Utilities—Regulated Electric": "규제 전력",
  "Utilities—Diversified": "다각화 유틸리티",
  "Utilities—Renewable": "재생에너지",
  // 부동산
  "Real Estate": "부동산",
  "REIT—Diversified": "다각화 리츠",
  "REIT—Industrial": "산업용 리츠",
  "REIT—Retail": "소매 리츠",
  "REIT—Residential": "주거용 리츠",
  "REIT—Specialty": "특수 리츠",
  // 소재
  Materials: "소재",
  "Basic Materials": "기초소재",
  Chemicals: "화학",
  "Specialty Chemicals": "특수화학",
  "Agricultural Inputs": "농업 투입재",
  Steel: "철강",
  Gold: "금",
  Copper: "구리",
  // 기타
  Conglomerates: "복합기업",
  "Business Services": "비즈니스 서비스",
  "Staffing & Employment Services": "인력서비스",
  Entertainment: "엔터테인먼트",
  "Electronic Gaming & Multimedia": "전자 게임",
  "Travel Services": "여행 서비스",
  "Resorts & Casinos": "리조트 및 카지노",
  "Lodging": "숙박",
  "Auto Manufacturers": "자동차 제조",
  "Auto Parts": "자동차 부품",
};

/**
 * 산업 섹터 한글명 가져오기
 */
function getIndustryKorean(industry: string | null): string | null {
  if (!industry) return null;
  return INDUSTRY_KOREAN[industry] ?? null;
}

/**
 * 평가 지표 설명 데이터
 */
const METRIC_INFO = {
  roe: {
    name: "ROE 지속성",
    fullName: "자기자본이익률 (Return on Equity)",
    maxScore: 25,
    description: "투자한 자본 대비 얼마나 효율적으로 수익을 내는지 평가",
    criteria: [
      { score: 25, condition: "전 기간 ROE 15% 이상" },
      { score: 20, condition: "80% 이상 기간 ROE 15% 이상" },
      { score: 15, condition: "전 기간 ROE 12% 이상" },
      { score: 10, condition: "80% 이상 기간 ROE 12% 이상" },
    ],
  },
  roic: {
    name: "ROIC 지속성",
    fullName: "투하자본수익률 (Return on Invested Capital)",
    maxScore: 20,
    description: "투자된 총 자본 대비 수익 창출 능력 평가",
    criteria: [
      { score: 20, condition: "전 기간 ROIC 12% 이상" },
      { score: 15, condition: "80% 이상 기간 ROIC 12% 이상" },
      { score: 10, condition: "전 기간 ROIC 9% 이상" },
      { score: 5, condition: "80% 이상 기간 ROIC 9% 이상" },
    ],
  },
  margin: {
    name: "Net Margin 안정성",
    fullName: "순이익률 (Net Profit Margin)",
    maxScore: 15,
    description: "매출 대비 순이익 비율과 안정성 평가",
    criteria: [
      { score: "10+5", condition: "평균 20%+ / 변동성 3% 이하" },
      { score: "7+3", condition: "평균 15%+ / 변동성 5% 이하" },
      { score: "5+1", condition: "평균 10%+ / 변동성 8% 이하" },
    ],
  },
  trend: {
    name: "수익성 추세",
    fullName: "ROE 개선 추세",
    maxScore: 15,
    description: "최근 수익성이 과거 대비 개선되고 있는지 평가",
    criteria: [
      { score: 15, condition: "ROE 20% 이상 개선" },
      { score: 12, condition: "ROE 10% 이상 개선" },
      { score: 9, condition: "ROE 5% 이상 개선" },
      { score: 6, condition: "ROE 유지" },
    ],
  },
  health: {
    name: "재무 건전성",
    fullName: "부채비율 + 이자보상배율",
    maxScore: 15,
    description: "부채 수준과 이자 지급 능력 평가",
    criteria: [
      { score: "10+5", condition: "부채비율 50% 이하 / 이자보상배율 10x+" },
      { score: "7+3", condition: "부채비율 80% 이하 / 이자보상배율 5x+" },
      { score: "4+1", condition: "부채비율 120% 이하 / 이자보상배율 3x+" },
    ],
  },
  cash: {
    name: "현금창출력",
    fullName: "잉여현금흐름률 (FCF Margin)",
    maxScore: 10,
    description: "영업활동에서 창출되는 실제 현금 비율",
    criteria: [
      { score: 10, condition: "FCF Margin 15% 이상" },
      { score: 7, condition: "FCF Margin 10% 이상" },
      { score: 4, condition: "FCF Margin 5% 이상" },
      { score: 2, condition: "FCF Margin 0% 이상" },
    ],
  },
};

interface BuffettCardProps {
  result: BuffettCardResponse;
}

export function BuffettCard({ result }: BuffettCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isPassed = result.pass_status === "PASS";
  const isUndervalued = result.is_undervalued && isPassed;
  const isBuy = result.recommendation === "BUY";

  // 한글 기업명 가져오기
  const koreanName = result.ticker ? KOREAN_NAMES[result.ticker] : null;

  // pass_reason JSON 파싱 (상세 지표)
  const passData = useMemo((): PassReasonData | null => {
    if (!result.pass_reason) return null;
    try {
      return JSON.parse(result.pass_reason) as PassReasonData;
    } catch {
      // 기존 텍스트 형식인 경우 null 반환
      return null;
    }
  }, [result.pass_reason]);

  // valuation_reason JSON 파싱 (적정가 분석)
  const valuationData = useMemo((): ValuationReasonData | null => {
    if (!result.valuation_reason) return null;
    try {
      return JSON.parse(result.valuation_reason) as ValuationReasonData;
    } catch {
      return null;
    }
  }, [result.valuation_reason]);

  // 카드 스타일 결정
  const getCardStyle = () => {
    if (isUndervalued && isBuy) {
      return "border-amber-500/50 bg-gradient-to-br from-amber-900/20 to-yellow-900/10 shadow-amber-500/20";
    } else if (isPassed) {
      return "border-red-500/50 bg-gradient-to-br from-red-900/20 to-rose-900/10 shadow-red-500/20";
    } else {
      return "border-gray-500/50 bg-gradient-to-br from-gray-900/20 to-slate-900/10 shadow-gray-500/20";
    }
  };

  // 배지 스타일
  const getBadgeStyle = () => {
    if (isUndervalued && isBuy) {
      return "bg-amber-500 text-black";
    } else if (isPassed) {
      return "bg-red-500 text-white";
    } else {
      return "bg-gray-500 text-white";
    }
  };

  // 배지 텍스트
  const getBadgeText = () => {
    if (isUndervalued && isBuy) {
      return "🔥 저평가";
    } else if (isPassed) {
      return "✓ 우량주";
    } else {
      return "- 미통과";
    }
  };

  // 가격 포맷
  const formatPrice = (price: number | null) => {
    if (price === null) return "-";
    return `$${price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // GAP 포맷
  const formatGap = (gap: number | null) => {
    if (gap === null) return "-";
    const sign = gap >= 0 ? "+" : "";
    return `${sign}${gap.toFixed(1)}%`;
  };

  // 점수 바 색상
  const getScoreBarColor = (score: number, maxScore: number) => {
    const ratio = score / maxScore;
    if (ratio >= 0.8) return "bg-green-500";
    if (ratio >= 0.6) return "bg-yellow-500";
    if (ratio >= 0.4) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <>
      {/* 카드 */}
      <div
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-lg border-2 p-4 transition-all duration-300 hover:scale-105 hover:shadow-2xl",
          getCardStyle()
        )}
      >
        {/* 배지 */}
        <div
          className={cn(
            "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
            getBadgeStyle()
          )}
        >
          {getBadgeText()}
        </div>

        {/* 티커 + 한글명 + 영문 회사명 */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-lg font-bold text-foreground">
              {result.ticker ?? "N/A"}
            </h3>
            {koreanName && (
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {koreanName}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {result.company_name ?? "Unknown"}
          </p>
          {result.industry && (
            <p className="mt-0.5 truncate text-[10px] text-blue-400/80">
              {result.industry}
              {getIndustryKorean(result.industry) && (
                <span className="ml-1">
                  {getIndustryKorean(result.industry)}
                </span>
              )}
            </p>
          )}
        </div>

        {/* 구분선 */}
        <div
          className={cn(
            "mb-3 h-px",
            isUndervalued
              ? "bg-amber-500/30"
              : isPassed
                ? "bg-red-500/30"
                : "bg-gray-500/30"
          )}
        />

        {/* 점수 + 신뢰등급 */}
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground">
              총점
            </p>
            <p
              className={cn(
                "text-xl font-bold",
                isUndervalued
                  ? "text-amber-700 dark:text-amber-400"
                  : isPassed
                    ? "text-red-400"
                    : "text-gray-400"
              )}
            >
              {result.total_score ?? 0}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-muted-foreground">
              신뢰등급
            </p>
            <p className="text-sm text-amber-700 dark:text-yellow-400">
              {result.trust_grade_stars ?? "☆☆☆☆☆"}
            </p>
          </div>
        </div>

        {/* 가격 정보 */}
        <div className="mb-2 grid grid-cols-2 gap-2 text-center">
          <div className="rounded bg-background/30 px-2 py-1">
            <p className="text-[9px] text-muted-foreground">현재가</p>
            <p className="text-sm font-semibold text-foreground">
              {formatPrice(result.current_price)}
            </p>
          </div>
          <div className="rounded bg-background/30 px-2 py-1">
            <p className="text-[9px] text-muted-foreground">적정가</p>
            <p
              className={cn(
                "text-sm font-semibold",
                isUndervalued ? "text-amber-700 dark:text-amber-400" : "text-foreground"
              )}
            >
              {formatPrice(result.intrinsic_value)}
            </p>
          </div>
        </div>

        {/* GAP % */}
        <div
          className={cn(
            "rounded-md px-2 py-1.5 text-center",
            isUndervalued
              ? "bg-amber-500/20"
              : isPassed
                ? "bg-red-500/10"
                : "bg-gray-500/10"
          )}
        >
          <p className="text-[9px] font-semibold text-muted-foreground">
            상승여력
          </p>
          <p
            className={cn(
              "text-lg font-bold",
              result.gap_pct && result.gap_pct > 0
                ? "text-green-400"
                : result.gap_pct && result.gap_pct < 0
                  ? "text-red-400"
                  : "text-muted-foreground"
            )}
          >
            {formatGap(result.gap_pct)}
          </p>
        </div>

        {/* 데이터 연수 + 클릭 안내 */}
        <div className="mt-2 text-center">
          <p className="text-[9px] text-muted-foreground">
            {result.years_data ?? 0}년 데이터 기준 • 클릭하여 상세보기
          </p>
        </div>
      </div>

      {/* 평가 상세 모달 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className={cn(
              "relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border-2 p-6",
              isUndervalued
                ? "border-amber-500/50 bg-gradient-to-br from-gray-950 to-amber-950/50"
                : isPassed
                  ? "border-red-500/50 bg-gradient-to-br from-gray-950 to-red-950/50"
                  : "border-gray-500/50 bg-gray-950"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              ✕
            </button>

            {/* 헤더 */}
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-foreground">
                  {result.ticker}
                </h2>
                {koreanName && (
                  <span className="text-lg font-medium text-amber-700 dark:text-amber-300">
                    {koreanName}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-bold",
                    getBadgeStyle()
                  )}
                >
                  {getBadgeText()}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.company_name}
              </p>
              {result.industry && (
                <p className="mt-1 text-xs text-blue-400">
                  📁 {result.industry}
                  {getIndustryKorean(result.industry) && (
                    <span className="ml-1">
                      {getIndustryKorean(result.industry)}
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* 총점 요약 */}
            <div className="mb-6 grid grid-cols-4 gap-4 rounded-lg bg-background/30 p-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">총점</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    isUndervalued
                      ? "text-amber-700 dark:text-amber-400"
                      : isPassed
                        ? "text-red-400"
                        : "text-gray-400"
                  )}
                >
                  {result.total_score}/100
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">현재가</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatPrice(result.current_price)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">적정가</p>
                <p
                  className={cn(
                    "text-lg font-semibold",
                    isUndervalued ? "text-amber-700 dark:text-amber-400" : "text-foreground"
                  )}
                >
                  {formatPrice(result.intrinsic_value)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">상승여력</p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    result.gap_pct && result.gap_pct > 0
                      ? "text-green-400"
                      : "text-red-400"
                  )}
                >
                  {formatGap(result.gap_pct)}
                </p>
              </div>
            </div>

            {/* 신뢰등급 */}
            <div className="mb-6 flex items-center justify-between rounded-lg bg-background/20 p-3">
              <div className="flex items-center gap-3">
                <span className="text-xl text-amber-700 dark:text-yellow-400">
                  {result.trust_grade_stars}
                </span>
                <span className="text-sm text-muted-foreground">
                  데이터 신뢰등급 ({result.years_data}년 데이터 기준)
                </span>
              </div>
            </div>

            {/* 우량주 평가 상세 */}
            {passData ? (
              <div className="mb-6">
                <h3 className="mb-4 text-lg font-bold text-foreground">
                  📊 우량주 평가 상세
                </h3>

                {/* 강점 요약 */}
                {passData.highlights.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {passData.highlights.map((h, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
                      >
                        💡 {h}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  {/* ROE */}
                  <MetricRow
                    metric={METRIC_INFO.roe}
                    score={passData.scores.roe}
                    actualValue={passData.values.avg_roe}
                    valueLabel="평균 ROE"
                    valueUnit="%"
                    getScoreBarColor={getScoreBarColor}
                  />

                  {/* ROIC */}
                  <MetricRow
                    metric={METRIC_INFO.roic}
                    score={passData.scores.roic}
                    actualValue={passData.values.avg_roic}
                    valueLabel="평균 ROIC"
                    valueUnit="%"
                    getScoreBarColor={getScoreBarColor}
                  />

                  {/* Net Margin */}
                  <MetricRow
                    metric={METRIC_INFO.margin}
                    score={passData.scores.margin}
                    actualValue={passData.values.avg_net_margin}
                    valueLabel="평균 순이익률"
                    valueUnit="%"
                    getScoreBarColor={getScoreBarColor}
                  />

                  {/* Trend */}
                  <MetricRow
                    metric={METRIC_INFO.trend}
                    score={passData.scores.trend}
                    actualValue={null}
                    valueLabel=""
                    valueUnit=""
                    getScoreBarColor={getScoreBarColor}
                  />

                  {/* Health */}
                  <MetricRow
                    metric={METRIC_INFO.health}
                    score={passData.scores.health}
                    actualValue={passData.values.debt_ratio}
                    valueLabel="부채비율"
                    valueUnit="%"
                    getScoreBarColor={getScoreBarColor}
                  />

                  {/* Cash */}
                  <MetricRow
                    metric={METRIC_INFO.cash}
                    score={passData.scores.cash}
                    actualValue={passData.values.avg_fcf_margin}
                    valueLabel="평균 FCF Margin"
                    valueUnit="%"
                    getScoreBarColor={getScoreBarColor}
                  />
                </div>
              </div>
            ) : (
              // 기존 텍스트 형식인 경우
              result.pass_reason && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    📊 평가 요약
                  </h3>
                  <div className="whitespace-pre-wrap rounded-lg bg-background/20 p-4 text-sm text-foreground/90">
                    {result.pass_reason}
                  </div>
                </div>
              )
            )}

            {/* 저평가 분석 */}
            {valuationData ? (
              <div className="mb-6">
                <h3 className="mb-4 text-lg font-bold text-foreground">
                  💰 저평가 분석
                </h3>
                <div className="rounded-lg bg-background/20 p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">EPS 연평균 성장률</p>
                      <p className="text-lg font-bold text-foreground">
                        {valuationData.eps_cagr.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">적용 PER</p>
                      <p className="text-lg font-bold text-foreground">
                        {valuationData.applied_per}배 ({valuationData.per_label})
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    * 적정가 = (미래 5년 EPS × 적정 PER) × 80% 안전마진
                  </p>
                </div>
              </div>
            ) : (
              // 기존 텍스트 형식인 경우
              result.valuation_reason && isPassed && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    💰 적정가 분석
                  </h3>
                  <div className="whitespace-pre-wrap rounded-lg bg-background/20 p-4 text-sm text-foreground/90">
                    {result.valuation_reason}
                  </div>
                </div>
              )
            )}

            {/* PASS가 아닌 경우 안내 */}
            {!isPassed && (
              <div className="rounded-lg bg-gray-800/50 p-4 text-center text-sm text-muted-foreground">
                이 종목은 버핏 우량주 기준(85점)을 통과하지 못했습니다.
              </div>
            )}

            {/* 푸터 */}
            <div className="mt-6 text-center text-xs text-muted-foreground">
              * 이 분석은 참고용이며 투자 권유가 아닙니다.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 지표별 상세 행 컴포넌트
 */
interface MetricRowProps {
  metric: {
    name: string;
    fullName: string;
    maxScore: number;
    description: string;
    criteria: { score: number | string; condition: string }[];
  };
  score: number | null;
  actualValue: number | null;
  valueLabel: string;
  valueUnit: string;
  getScoreBarColor: (score: number, maxScore: number) => string;
}

function MetricRow({
  metric,
  score,
  actualValue,
  valueLabel,
  valueUnit,
  getScoreBarColor,
}: MetricRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayScore = score ?? 0;

  return (
    <div className="rounded-lg bg-background/20 p-3">
      {/* 기본 정보 */}
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-32">
            <p className="text-sm font-semibold text-foreground">
              {metric.name}
            </p>
            {actualValue !== null && (
              <p className="text-xs text-muted-foreground">
                {valueLabel}: {actualValue.toFixed(1)}
                {valueUnit}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 점수 바 */}
          <div className="w-32">
            <div className="h-2 rounded-full bg-gray-700">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  getScoreBarColor(displayScore, metric.maxScore)
                )}
                style={{
                  width: `${(displayScore / metric.maxScore) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* 점수 */}
          <div className="w-16 text-right">
            <span className="text-lg font-bold text-foreground">
              {displayScore}
            </span>
            <span className="text-xs text-muted-foreground">
              /{metric.maxScore}
            </span>
          </div>

          {/* 확장 아이콘 */}
          <span className="text-muted-foreground">
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* 확장 내용 */}
      {isExpanded && (
        <div className="mt-3 border-t border-gray-700/50 pt-3">
          <p className="mb-2 text-xs text-amber-700 dark:text-amber-300/80">{metric.fullName}</p>
          <p className="mb-3 text-xs text-muted-foreground">
            {metric.description}
          </p>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">
              평가 기준:
            </p>
            {metric.criteria.map((c, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                • {c.score}점: {c.condition}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
