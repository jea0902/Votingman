"use client";

/**
 * 검증된 매매법 페이지
 *
 * 설계 의도:
 * - 1차 MVP 홈에 있던 헤드라인·부제·매매법 카드를 이 페이지로 이전
 * - 실효적 데이터/통계 기반 코인 매매법 소개 및 카드 그리드 제공
 */

import { StrategyCard } from "@/components/home";

interface Strategy {
  id: string;
  name: string;
  backtestingPeriod: string;
  monthlyReturn: string;
  annualReturn: string;
  winRate: string;
  profitLossRatio: string;
  colorTheme: "blue" | "amber" | "green";
}

const DUMMY_STRATEGIES: Strategy[] = [
  {
    id: "1",
    name: "매매법 1",
    backtestingPeriod: "2020.01 ~ 2024.12 (5년)",
    monthlyReturn: "+3.2%",
    annualReturn: "+42.5%",
    winRate: "68.5%",
    profitLossRatio: "2.8:1",
    colorTheme: "blue",
  },
  {
    id: "2",
    name: "매매법 2",
    backtestingPeriod: "2019.06 ~ 2024.12 (5.5년)",
    monthlyReturn: "+4.1%",
    annualReturn: "+58.3%",
    winRate: "72.3%",
    profitLossRatio: "3.2:1",
    colorTheme: "amber",
  },
  {
    id: "3",
    name: "매매법 3",
    backtestingPeriod: "2021.01 ~ 2024.12 (4년)",
    monthlyReturn: "+2.8%",
    annualReturn: "+38.7%",
    winRate: "65.2%",
    profitLossRatio: "2.5:1",
    colorTheme: "green",
  },
];

export default function VerifiedStrategiesPage() {
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
        {/* 기능 준비중 안내 */}
        <div className="mb-8 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-center text-sm font-medium text-amber-600 dark:text-amber-400">
          이 기능은 현재 준비 중입니다.
        </div>

        {/* 헤드라인 */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-5xl font-bold tracking-tight text-[#3b82f6] sm:text-6xl lg:text-7xl">
            실효적 데이터/통계로 검증된 코인 매매법
          </h1>
          <p className="text-xl font-medium text-[#fbbf24] sm:text-2xl lg:text-3xl">
            감정 대신 수학적 통계로 투자하세요!
            <br />
            유효한 지표들로 백테스팅이 끝난 전략을 떠먹여 드립니다
          </p>
        </div>

        {/* 매매법 카드 그리드 (3개) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DUMMY_STRATEGIES.map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} />
          ))}
        </div>

        {/* L3 섹션 플레이스홀더 */}
        <div className="mt-12 space-y-6">
          {[
            "2. 찐 공포/탐욕 지수",
            "3. 고수/인플루언서 실시간 포지션",
            "4. CVD와 고래 매수/매도 신호",
            "5. 주요 수요/공급망 포지션",
            "6. 매물대 × 청산맵",
          ].map((label) => (
            <section
              key={label}
              className="min-h-[120px] rounded border border-dashed border-gray-500/60 bg-transparent p-4"
              style={{ borderWidth: "1px" }}
            >
              <p className="text-xs font-medium text-gray-400">{label}</p>
              <p className="mt-1 text-[10px] font-mono text-gray-600">
                L3 섹션 · 추후 콘텐츠
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
