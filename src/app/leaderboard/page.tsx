"use client";

/**
 * 투표 보상 페이지 (보팅맨배)
 *
 * - MMR TOP 10: 선물하기 3만원권 + 명예 배지
 * - TOP 30: 명예 배지
 * - 상금: 현재 월 30만 원 (3개월) → 이후 광고 수익 50% 추가 누적 및 보상 인원 추가
 */

import { Trophy, Gift, Award, Info } from "lucide-react";
import { MarketTop30Positions } from "@/components/leaderboard/MarketTop30Positions";

export default function LeaderboardPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 히어로 */}
      <section className="mb-8 text-center">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
          <Trophy className="h-8 w-8 shrink-0 text-amber-700 dark:text-amber-500" />
          보팅맨배 투표 보상
        </h1>
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-2 text-sm font-medium">
          <span className="text-muted-foreground">현재 상금</span>
          <span className="text-foreground">월 30만 원</span>
        </div>
      </section>

      {/* 보상 내용 */}
      <section className="mb-8 rounded-lg border border-border bg-muted/20 p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">보상 내용</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="font-medium text-foreground">1~10위</span>
            <Gift className="h-4 w-4 text-amber-700 dark:text-amber-500" />
            선물하기 3만원권 + 명예 배지
          </li>
          <li className="flex items-center gap-2">
            <span className="font-medium text-foreground">11~30위</span>
            <Award className="h-4 w-4 text-primary" />
            명예 배지
          </li>
        </ul>
      </section>

      {/* 상금 규모 */}
      <section className="mb-8 rounded-lg border border-border bg-muted/20 p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">상금 규모</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>· 현재: 월 30만 원</li>
          <li>· 이후: 광고 수익의 50% 추가 누적 및 보상 인원 추가</li>
        </ul>
      </section>

      {/* 랭킹 기준 */}
      <section className="mb-8 rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">랭킹 기준</span>
          {" "}
          MMR = 보유 VTC × 누적 승률 (높을수록 상위)
        </p>
      </section>

      {/* TOP 30 테이블 */}
      <section className="mb-8">
        <MarketTop30Positions variant="leaderboard" />
      </section>

      {/* 유의사항 */}
      <section className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <p className="text-xs font-medium text-destructive">
          매월 마지막 날짜 기준 23:00에 MMR TOP 30의 인원을 스냅샷으로 찍어, 매월 1일 15:00에 보상 지급, 명예 배지는 개인 프로필에 표시됩니다.
        </p>
      </section>
    </div>
  );
}
