/**
 * Bitcos 홈 메인 (1차 MVP)
 *
 * 설계 의도:
 * - 워렌 버핏 기준 우량주/저평가 종목 카드 레이아웃
 * - 빨간색: 우량주, 황금색: 우량주 + 저평가
 * - Deep Dark 테마 유지
 */

import { StockCard } from "@/components/home";

// 더미 데이터 타입
interface Stock {
  id: string;
  name: string;
  ticker: string;
  logo: string;
  qualityCriteria: string[];
  undervalued: boolean;
  undervaluedReason?: string;
  fairValue: string;
}

// 더미 종목 데이터
const DUMMY_STOCKS: Stock[] = [
  {
    id: "1",
    name: "삼성전자",
    ticker: "005930",
    logo: "🔷",
    qualityCriteria: ["ROE 15%↑", "부채비율 50%↓", "배당 10년↑"],
    undervalued: true,
    undervaluedReason: "PER 8.5 (업계 평균 12)",
    fairValue: "₩95,000",
  },
  {
    id: "2",
    name: "SK하이닉스",
    ticker: "000660",
    logo: "💾",
    qualityCriteria: ["ROE 18%↑", "영업이익률 20%↑", "현금흐름 안정"],
    undervalued: true,
    undervaluedReason: "PBR 1.2 (역사적 평균 1.8)",
    fairValue: "₩185,000",
  },
  {
    id: "3",
    name: "현대차",
    ticker: "005380",
    logo: "🚗",
    qualityCriteria: ["ROE 12%↑", "배당수익률 3%↑", "순이익 증가"],
    undervalued: false,
    fairValue: "₩245,000",
  },
  {
    id: "4",
    name: "NAVER",
    ticker: "035420",
    logo: "🟢",
    qualityCriteria: ["매출 성장 25%↑", "시장 점유율 1위", "R&D 투자"],
    undervalued: true,
    undervaluedReason: "PSR 2.1 (글로벌 평균 3.5)",
    fairValue: "₩280,000",
  },
  {
    id: "5",
    name: "카카오",
    ticker: "035720",
    logo: "💬",
    qualityCriteria: ["MAU 성장", "다각화 수익", "플랫폼 독점"],
    undervalued: false,
    fairValue: "₩68,000",
  },
  {
    id: "6",
    name: "LG화학",
    ticker: "051910",
    logo: "⚗️",
    qualityCriteria: ["배터리 점유율 2위", "ROE 10%↑", "글로벌 진출"],
    undervalued: true,
    undervaluedReason: "EV/EBITDA 6.2 (업계 평균 9.1)",
    fairValue: "₩580,000",
  },
  {
    id: "7",
    name: "POSCO홀딩스",
    ticker: "005490",
    logo: "🏭",
    qualityCriteria: ["원가 경쟁력", "배당 15년↑", "안정적 현금"],
    undervalued: false,
    fairValue: "₩385,000",
  },
  {
    id: "8",
    name: "기아",
    ticker: "000270",
    logo: "🚙",
    qualityCriteria: ["ROE 14%↑", "영업이익률 8%↑", "브랜드 가치"],
    undervalued: true,
    undervaluedReason: "PER 6.8 (글로벌 평균 10.2)",
    fairValue: "₩125,000",
  },
  {
    id: "9",
    name: "KB금융",
    ticker: "105560",
    logo: "🏦",
    qualityCriteria: ["ROE 11%↑", "배당수익률 5%↑", "부실채권률 ↓"],
    undervalued: false,
    fairValue: "₩72,000",
  },
  {
    id: "10",
    name: "셀트리온",
    ticker: "068270",
    logo: "💊",
    qualityCriteria: ["글로벌 시장 진출", "파이프라인", "매출 성장"],
    undervalued: true,
    undervaluedReason: "PEG 0.8 (성장 대비 저평가)",
    fairValue: "₩220,000",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] w-full">
      {/* 배경 그라데이션 */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute left-1/2 top-0 h-[300px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(59,130,246,0.15),transparent)]" />
      </div>

      {/* 메인 콘텐츠 (좌우 15% 여백) */}
      <div className="mx-auto w-[70%] px-4 py-12">
        {/* 헤드라인 */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-5xl font-bold tracking-tight text-[#3b82f6] sm:text-6xl lg:text-7xl">
            워렌 버핏 기준 통과 종목과 적정가
          </h1>
          <p className="text-xl font-medium text-[#fbbf24] sm:text-2xl lg:text-3xl">
            감정 대신 숫자로 투자하세요.<br />
            바로 저평가 우량주를 떠먹여 드립니다
          </p>
        </div>

        {/* 종목 카드 그리드 (한 줄에 5개) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {DUMMY_STOCKS.map((stock) => (
            <StockCard key={stock.id} stock={stock} />
          ))}
        </div>
      </div>
    </div>
  );
}
