"use client";

/**
 * 홈 메인 콘텐츠 (로그인 시 노출)
 *
 * - UserInfoCard, VotingSection, L3 플레이스홀더
 */

import { VotingSection } from "@/components/home";
import { CoinHeroCards } from "@/components/home/CoinHeroCards";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { TickerStrip } from "@/components/home/TickerStrip";
import { MacroSidebar } from "@/components/home/MacroSidebar";
import { useState } from "react";

export function HomeContent() {
  const [selectedCoin, setSelectedCoin] = useState<"btc" | "eth" | "xrp">("btc");

  return (
    <div className="relative w-full">
      <div className="mx-auto w-full max-w-7xl pl-4 pr-2 sm:pl-6 sm:pr-4">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-20">
          {/* Left: 투표 + 피드 */}
          <div className="min-w-0 w-full lg:flex-1 lg:max-w-2xl">
            <div className="w-full space-y-6">
              <TickerStrip />
              <CoinHeroCards selectedCoin={selectedCoin} onSelectCoin={setSelectedCoin} />
              <VotingSection selectedCoin={selectedCoin} />
              <CommunityFeed />
            </div>
          </div>

          {/* Right: 매크로 위젯 (데스크탑 전용) */}
          <aside className="hidden w-80 shrink-0 lg:block">
            <div className="sticky top-[92px] md:top-20">
              <MacroSidebar />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
