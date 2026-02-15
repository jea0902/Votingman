"use client";

/**
 * 리더보드 페이지
 *
 * 설계 의도:
 * - 보팅맨 TOP20 랭커 실시간 포지션 (MMR 순)
 * - 바이낸스 선물 랭커 TOP3는 투표(홈) 페이지로 이동
 */

import { Trophy } from "lucide-react";
import { MarketTop20Positions } from "@/components/home";

export default function LeaderboardPage() {
  return (
    <div className="w-full px-4 py-8 sm:px-6">
      <h1 className="mb-8 flex items-center justify-center gap-2 text-center text-2xl font-bold text-foreground sm:text-3xl">
        <Trophy className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
        리더보드
      </h1>
      <div className="mx-auto max-w-3xl">
        <MarketTop20Positions />
      </div>
    </div>
  );
}
