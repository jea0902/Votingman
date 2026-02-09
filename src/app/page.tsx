"use client";

/**
 * 보팅맨 홈 메인 (2차 MVP)
 *
 * - 메인 문구 → UserInfoCard → 투표 기능(HumanIndicatorSection) → L3 플레이스홀더
 * - 실시간 포지션(보팅맨 TOP5, 비트멕스, 유튜버)은 /leaderboard 페이지로 이동
 */

import { HumanIndicatorSection } from "@/components/home";

const SECTION_LABELS = [
  "2. 찐 공포/탐욕 지수",
  "3. 고수/인플루언서 실시간 포지션",
  "4. CVD와 고래 매수/매도 신호",
  "5. 주요 수요/공급망 포지션",
  "6. 매물대 × 청산맵",
] as const;

export default function Home() {
  return (
    <div className="relative w-full">
      {/* 배경 레이어 (홈 메인 전용) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute left-1/2 top-0 h-[300px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(59,130,246,0.08),transparent)]" />
      </div>

      {/* 메인: 양옆 10% 여백, 가운데 80% */}
      <div className="mx-auto flex w-[80%] max-w-7xl flex-col gap-8 px-4 sm:px-6">
        <div className="min-w-0">
          <div className="mb-6 flex min-h-[20vh] flex-col justify-center text-center">
            <h1 className="mb-4 text-5xl font-bold tracking-tight text-[#3b82f6] sm:text-6xl lg:text-7xl">
              탈중앙화 예측 배팅 플랫폼
            </h1>
            <p className="text-xl font-medium text-[#fbbf24] sm:text-2xl lg:text-3xl">
              말이 아닌 돈으로 예측하는 진짜 시장의 방향 <br />
              집단지성 기반의 투자 인사이트 플랫폼
            </p>
          </div>
        </div>
        <div className="min-w-0 w-full">
          <div className="w-full space-y-6">
            <div className="space-y-6">
              <HumanIndicatorSection />
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
      </div>
    </div>
  );
}
