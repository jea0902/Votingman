"use client";

/**
 * 투표 보상 페이지 (보팅맨배)
 *
 * - MMR TOP 10: 선물하기 3만원권 + 명예 배지
 * - TOP 30: 명예 배지
 * - 상금: 현재 월 30만 원 (3개월) → 이후 광고 수익 50% 추가 누적 및 보상 인원 추가
 */

import { useState, useEffect } from "react";
import { Trophy, Gift, Award, Info } from "lucide-react";
import { MarketTop30Positions } from "@/components/leaderboard/MarketTop30Positions";
import { ClaimRewardModal } from "@/components/leaderboard/ClaimRewardModal";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { LeaderboardTop30Item, LeaderboardTop30Response } from "@/app/api/leaderboard/top30/route";

export default function LeaderboardPage() {
  const { currentUser, isLoadingUser } = useCurrentUser();
  const [top30Data, setTop30Data] = useState<LeaderboardTop30Response | null>(null);
  const [claimModalOpen, setClaimModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard/top30")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && json.data) setTop30Data(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const myEntry = currentUser && top30Data?.top30
    ? top30Data.top30.find((item: LeaderboardTop30Item) => item.user_id === currentUser.id)
    : null;
  const isTop10 = myEntry != null && myEntry.rank <= 10;

  const handleClaimSubmit = async (phoneNumber: string, privacyConsent: boolean) => {
    const res = await fetch("/api/reward/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phoneNumber, privacy_consent: privacyConsent }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message ?? "제출에 실패했습니다.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 히어로 */}
      <section className="mb-8 text-center">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
          <Trophy className="h-8 w-8 shrink-0 text-amber-700 dark:text-amber-500" />
          보팅맨배 투표 보상
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-2 text-sm font-medium">
            <span className="text-muted-foreground">현재 상금</span>
            <span className="text-foreground">월 30만 원</span>
          </div>
          {!isLoadingUser && isTop10 && myEntry && (
            <Button
              size="sm"
              onClick={() => setClaimModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Gift className="h-4 w-4" />
              보상 받기
            </Button>
          )}
        </div>
      </section>

      <ClaimRewardModal
        open={claimModalOpen}
        onOpenChange={setClaimModalOpen}
        rank={myEntry?.rank ?? 0}
        onSubmit={handleClaimSubmit}
      />

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
