"use client";

/**
 * 보팅맨 홈 메인 (2차 MVP)
 *
 * - 작은 화면: 메인 문구 → 유튜버 포지션 → 비트멕스 리더보드 → 시장 탭 → 투표 → UserInfo → 보팅맨 TOP5
 * - 큰 화면: 왼쪽 25% (UserInfo, 보팅맨 TOP5) | 가운데 50% (메인 문구, 시장 탭, 인간 지표) | 오른쪽 25% (비트멕스, 유튜버)
 */

import { useState } from "react";
import { HumanIndicatorSection, InfluencerPositions, MarketTabCards, MarketTop5Positions, TopRankersBoard, UserInfoCard } from "@/components/home";
import type { HomeTabKey } from "@/components/home/HumanIndicatorSection";

const SECTION_LABELS = [
  "2. 찐 공포/탐욕 지수",
  "3. 고수/인플루언서 실시간 포지션",
  "4. CVD와 고래 매수/매도 신호",
  "5. 주요 수요/공급망 포지션",
  "6. 매물대 × 청산맵",
] as const;

export default function Home() {
  const [activeTab, setActiveTab] = useState<HomeTabKey>("btc");

  return (
    <div className="relative w-full">
      {/* 배경 레이어 (홈 메인 전용) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute left-1/2 top-0 h-[300px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(59,130,246,0.08),transparent)]" />
      </div>

      {/*
        작은 화면: flex-col, DOM 순서대로 1→7 노출
        큰 화면: 3열(왼쪽 | 가운데 | 오른쪽), 가운데·오른쪽은 한 컬럼씩 묶어서 세로 간격/누락 방지
      */}

      {/* 작은 화면: 7개 블록 순서 유지 */}
      <div className="flex flex-col gap-8 px-4 sm:px-6 lg:hidden">
        <div className="min-w-0">
          <div className="mb-6 flex min-h-[20vh] flex-col justify-center text-center">
            <h1 className="mb-4 text-5xl font-bold tracking-tight text-[#3b82f6] sm:text-6xl lg:text-7xl">
              탈중앙화 시장 예측 배팅 플랫폼
            </h1>
            <p className="text-xl font-medium text-[#fbbf24] sm:text-2xl lg:text-3xl">
              투자자들이 코인을 배팅해 투자 심리를 반영한 인간 지표
            </p>
          </div>
        </div>
        <div className="min-w-0">
          <InfluencerPositions />
        </div>
        <div className="min-w-0">
          <TopRankersBoard />
        </div>
        <div className="min-w-0">
          <MarketTabCards activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        <div className="min-w-0">
          <div className="mx-auto max-w-4xl space-y-6">
            <div
              id={`panel-${activeTab}-sm`}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              className="space-y-6"
            >
              <HumanIndicatorSection activeTab={activeTab} />
              {SECTION_LABELS.map((label) => (
                <section
                  key={label}
                  className="min-h-[120px] rounded border border-dashed border-gray-500/60 bg-transparent p-4"
                  style={{ borderWidth: "1px" }}
                >
                  <p className="text-xs font-medium text-gray-400">{label}</p>
                  <p className="mt-1 text-[10px] text-gray-600 font-mono">
                    L3 섹션 · 추후 콘텐츠
                  </p>
                </section>
              ))}
            </div>
          </div>
        </div>
        <div className="min-w-0 flex flex-col gap-3">
          <UserInfoCard />
          <MarketTop5Positions activeTab={activeTab} />
        </div>
      </div>

      {/* 큰 화면: 3열, 가운데·오른쪽 한 컬럼씩 묶어서 문구-시장탭-투표 간격 최소화 + 비트멕스 항상 노출 */}
      <div className="hidden px-4 lg:grid lg:grid-cols-[1fr_2fr_1fr] lg:items-start lg:gap-x-8 lg:px-6">
        {/* 왼쪽: UserInfo + 보팅맨 TOP5, 상단 20% 패딩 */}
        <aside className="min-h-0 min-w-0 flex flex-col gap-3 lg:sticky lg:top-4 lg:pt-[20vh] lg:pr-3">
          <UserInfoCard />
          <MarketTop5Positions activeTab={activeTab} />
        </aside>

        {/* 가운데: 문구(20vh) → 시장 탭 → 투표, flex로 붙여서 여백 최소화 */}
        <main className="min-w-0 flex flex-col gap-4 lg:px-2">
          <div className="flex min-h-[20vh] flex-col justify-end text-center">
            <h1 className="mb-4 text-5xl font-bold tracking-tight text-[#3b82f6] sm:text-6xl lg:text-7xl">
              탈중앙화 시장 예측 배팅 플랫폼
            </h1>
            <p className="text-xl font-medium text-[#fbbf24] sm:text-2xl lg:text-3xl">
              투자자들이 코인을 배팅해 투자 심리를 반영한 인간 지표
            </p>
          </div>
          <div>
            <MarketTabCards activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <div
              id={`panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              className="space-y-6"
            >
              <HumanIndicatorSection activeTab={activeTab} />
              {SECTION_LABELS.map((label) => (
                <section
                  key={label}
                  className="min-h-[120px] rounded border border-dashed border-gray-500/60 bg-transparent p-4"
                  style={{ borderWidth: "1px" }}
                >
                  <p className="text-xs font-medium text-gray-400">{label}</p>
                  <p className="mt-1 text-[10px] text-gray-600 font-mono">
                    L3 섹션 · 추후 콘텐츠
                  </p>
                </section>
              ))}
            </div>
          </div>
        </main>

        {/* 오른쪽: 유튜버 → 비트멕스, 한 컬럼에 세로로 배치해 둘 다 노출 */}
        <aside className="min-h-0 min-w-0 flex flex-col gap-4 lg:pl-3">
          <InfluencerPositions />
          <TopRankersBoard />
        </aside>
      </div>
    </div>
  );
}
