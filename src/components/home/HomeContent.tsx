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
