"use client";

/**
 * 리더보드 페이지
 *
 * 설계 의도:
 * - 가로 화면 3열: 보팅맨 TOP5 | 비트멕스 리더보드 TOP5 | 코인 유튜버 실시간 포지션
 * - 작은 화면: 세로 배치
 */

import { InfluencerPositions, MarketTop5Positions, TopRankersBoard } from "@/components/home";

export default function LeaderboardPage() {
  return (
    <div className="w-full px-4 py-8 sm:px-6">
      <h1 className="mb-8 text-center text-2xl font-bold text-foreground sm:text-3xl">
        리더보드
      </h1>

      {/* 큰 화면: 3열 */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-3">
        <aside className="min-w-0">
          <MarketTop5Positions />
        </aside>
        <aside className="min-w-0">
          <TopRankersBoard />
        </aside>
        <aside className="min-w-0">
          <InfluencerPositions />
        </aside>
      </div>

      {/* 작은 화면: 세로 배치 */}
      <div className="flex flex-col gap-8 lg:hidden">
        <section>
          <MarketTop5Positions />
        </section>
        <section>
          <TopRankersBoard />
        </section>
        <section>
          <InfluencerPositions />
        </section>
      </div>
    </div>
  );
}
