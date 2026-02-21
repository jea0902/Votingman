"use client";

/**
 * 홈 메인 콘텐츠 (로그인 시 노출)
 *
 * - UserInfoCard, HumanIndicatorSection, L3 플레이스홀더
 */

import { HumanIndicatorSection } from "@/components/home";

export function HomeContent() {
  return (
    <div className="relative w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="mb-4 flex min-h-[8vh] flex-col justify-center py-4 text-center">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-[#3b82f6] sm:text-3xl lg:text-4xl">
              예측 시장 플랫폼
            </h1>
            <p className="text-base font-medium text-amber-700 dark:text-[#fbbf24] sm:text-lg lg:text-xl">
              말이 아닌 돈으로 예측하는 진짜 시장의 방향
            </p>
          </div>
        </div>
        <div className="min-w-0 w-full">
          <div className="w-full space-y-6">
            <HumanIndicatorSection />
          </div>
        </div>
      </div>
    </div>
  );
}
