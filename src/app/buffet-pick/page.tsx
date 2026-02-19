/**
 * 버핏원픽 페이지
 *
 * 설계 의도:
 * - Supabase DB에서 버핏 평가 결과를 가져와 표시
 * - 황금색: 우량주 + 저평가 (PASS + BUY)
 * - 빨간색: 우량주 (PASS + WAIT)
 * - Deep Dark 테마 유지
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { BuffettCard, StockCard } from "@/components/home";
import type { BuffettCardResponse } from "@/lib/supabase/db-types";

// 더미 데이터 타입 (기존 호환용)
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

// 더미 종목 데이터 (DB 데이터 없을 때 표시)
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
];

/**
 * Supabase에서 최신 버핏 평가 결과 가져오기
 */
async function getBuffettResults(): Promise<BuffettCardResponse[]> {
  try {
    const supabase = createSupabaseAdmin();
    
    // 최신 run_id 조회
    const { data: runData, error: runError } = await supabase
      .from("buffett_run")
      .select("run_id")
      .order("run_date", { ascending: false })
      .limit(1);
    
    if (runError || !runData || runData.length === 0) {
      return [];
    }
    
    const runId = runData[0].run_id;
    
    // 평가 결과 조회 (PASS만, 총점 내림차순)
    const { data, error } = await supabase
      .from("buffett_result")
      .select(`
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
        valuation_reason,
        created_at,
        stocks (
          ticker,
          company_name,
          industry
        )
      `)
      .eq("run_id", runId)
      .order("total_score", { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    // 데이터 변환
    return data.map((row: any) => {
      const stock = Array.isArray(row.stocks) ? row.stocks[0] : row.stocks;
      return {
        run_id: row.run_id,
        stock_id: row.stock_id,
        ticker: stock?.ticker ?? null,
        company_name: stock?.company_name ?? null,
        industry: stock?.industry ?? null,
        current_price: row.current_price,
        price_date: null,
        total_score: row.total_score,
        pass_status: row.pass_status,
        intrinsic_value: row.intrinsic_value,
        gap_pct: row.gap_pct,
        recommendation: row.recommendation,
        is_undervalued: row.is_undervalued,
        years_data: row.years_data,
        trust_grade: row.trust_grade,
        trust_grade_text: row.trust_grade_text,
        trust_grade_stars: row.trust_grade_stars,
        pass_reason: row.pass_reason,
        valuation_reason: row.valuation_reason,
        created_at: row.created_at,
      };
    });
  } catch (error) {
    console.error("Failed to fetch buffett results:", error);
    return [];
  }
}

export default async function BuffetPickPage() {
  // DB에서 버핏 평가 결과 가져오기
  const buffettResults = await getBuffettResults();
  
  // PASS 종목만 필터링
  const passedResults = buffettResults.filter(r => r.pass_status === "PASS");
  
  // 저평가 우량주 (BUY)
  const undervaluedResults = passedResults.filter(r => r.recommendation === "BUY");
  
  // 우량주 (WAIT)
  const qualityResults = passedResults.filter(r => r.recommendation === "WAIT");

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
          <p className="text-xl font-medium text-amber-700 dark:text-[#fbbf24] sm:text-2xl lg:text-3xl">
            감정 대신 숫자로 투자하세요.<br />
            바로 저평가 우량주를 떠먹여 드립니다
          </p>

          {/* 서비스 설명 문구 */}
          <div className="mx-auto mt-8 max-w-3xl space-y-2 text-sm text-muted-foreground">
            <p>
              미국 주식 중 <span className="font-bold">S&P 500</span>과 <span className="font-bold">NASDAQ 100</span> 지수에 편입된 종목만 평가합니다.
            </p>
            <p>
              오직 워렌 버핏의 펀더멘탈 평가 기준에 맞게 평가했으며, <span className="font-bold">과거 데이터의 평균 지표</span>를 기반으로 가치 평가를 매겼습니다.
              <br />
              <span className="font-bold">85점 이상</span>만 우량주로 평가되어 아래에 표시됩니다.
            </p>
            <p className="text-amber-700 dark:text-amber-400/80">
              💡 각 카드를 클릭하면 구체적인 버핏의 평가 이유를 확인할 수 있습니다.
            </p>
          </div>
        </div>

        {/* DB 데이터가 있는 경우 */}
        {buffettResults.length > 0 && (
          <>
            {/* 저평가 우량주 섹션 */}
            {undervaluedResults.length > 0 && (
              <div className="mb-12">
                <h2 className="mb-6 text-2xl font-bold text-amber-700 dark:text-amber-400">
                  🔥 저평가 우량주 ({undervaluedResults.length}개)
                  <span className="ml-3 text-sm font-normal text-muted-foreground">
                    워렌 버핏보다 20% 더 보수적으로 적정가(5년 내 도달 가능한 가격)를 산정
                  </span>
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {undervaluedResults.map((result) => (
                    <BuffettCard key={result.stock_id} result={result} />
                  ))}
                </div>
              </div>
            )}

            {/* 우량주 섹션 */}
            {qualityResults.length > 0 && (
              <div className="mb-12">
                <h2 className="mb-6 text-2xl font-bold text-red-400">
                  ✓ 우량주 ({qualityResults.length}개)
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {qualityResults.map((result) => (
                    <BuffettCard key={result.stock_id} result={result} />
                  ))}
                </div>
              </div>
            )}

            {/* 평가 결과 없는 경우 */}
            {passedResults.length === 0 && (
              <div className="mb-12 rounded-lg border border-gray-500/30 bg-gray-900/20 p-8 text-center">
                <p className="text-lg text-muted-foreground">
                  아직 우량주 기준을 통과한 종목이 없습니다.
                </p>
              </div>
            )}

            {/* 구분선 */}
            <div className="my-12 h-px bg-gray-700" />
          </>
        )}

        {/* DB 데이터 없거나 더미 데이터 표시 */}
        <div className="mb-8">
          <h2 className="mb-6 text-xl font-semibold text-muted-foreground">
            {buffettResults.length > 0 
              ? "📋 예시 데이터 (한국 주식)" 
              : "📋 데이터 로딩 중... (예시 데이터)"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {DUMMY_STOCKS.map((stock) => (
              <StockCard key={stock.id} stock={stock} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
