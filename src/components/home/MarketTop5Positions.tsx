"use client";

/**
 * 보팅맨 가입 유저 TOP5 실시간 포지션(투표)
 * - 홈 탭(비트코인 | 미국 주식 | 한국 주식)에 따라 해당 시장 투표 기준 TOP5 표시
 * - 8단계: 실데이터 연동 (GET /api/leaderboard/top5)
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HomeTabKey } from "./HumanIndicatorSection";
import type { LeaderboardTop5Item, LeaderboardTop5Response } from "@/app/api/leaderboard/top5/route";

type PositionRow = {
  rank: number;
  nickname: string;
  choice: "long" | "short";
  betAmount: number;
};

/** API 응답 top5 + 시장 키로 해당 시장 포지션만 있는 PositionRow[] 생성 */
function toPositionRows(
  top5: LeaderboardTop5Item[],
  marketKey: string
): PositionRow[] {
  return top5.map((item) => {
    const pos = item.positions[marketKey];
    return {
      rank: item.rank,
      nickname: item.nickname,
      choice: pos?.choice ?? "long",
      betAmount: pos?.bet_amount ?? 0,
    };
  });
}

/** 공통: 섹션 헤더 + 컬럼 헤더 + TOP5 행 렌더링 */
function PositionsSection({
  title,
  rows,
}: {
  title: string;
  rows: PositionRow[];
}) {
  return (
    <section className="space-y-2">
      <p className="px-3 text-xs font-medium text-muted-foreground">{title}</p>
      {/* 컬럼명: 순위 | 닉네임 | 포지션 | 배팅 VTC (데이터 행과 동일 그리드로 일직선 정렬) */}
      <div className="grid grid-cols-[auto_1fr_4rem_5.5rem] gap-2 px-3 pb-1.5 text-xs font-medium text-muted-foreground">
        <span className="text-right">순위</span>
        <span className="min-w-0 overflow-hidden text-ellipsis">닉네임</span>
        <span className="text-center">포지션</span>
        <span className="text-right">배팅 VTC</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={`${title}-${row.rank}`}
            className="grid min-w-0 grid-cols-[auto_1fr_4rem_5.5rem] items-center gap-2 overflow-hidden rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
          >
            <span className="shrink-0 text-right font-medium text-muted-foreground tabular-nums">
              {row.rank}위
            </span>
            <span
              className="min-w-0 overflow-hidden text-ellipsis font-medium text-foreground"
              title={row.nickname}
            >
              {row.nickname.length > 5 ? `${row.nickname.slice(0, 5)}…` : row.nickname}
            </span>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-bold",
                row.betAmount === 0 && "bg-muted text-muted-foreground",
                row.betAmount > 0 && row.choice === "long" && "bg-emerald-500/20 text-emerald-500",
                row.betAmount > 0 && row.choice === "short" && "bg-rose-500/20 text-rose-500"
              )}
            >
              {row.betAmount === 0 ? "-" : row.choice === "long" ? "롱" : "숏"}
            </span>
            <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {row.betAmount === 0 ? "-" : `${row.betAmount.toLocaleString()} VTC`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const SECTION_TO_PARAM: Record<HomeTabKey, string> = {
  btc: "btc",
  us: "us",
  kr: "kr",
};

export function MarketTop5Positions({
  activeTab,
  className,
}: {
  activeTab: HomeTabKey;
  className?: string;
}) {
  const [data, setData] = useState<LeaderboardTop5Response | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const section = SECTION_TO_PARAM[activeTab];

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setIsLoading(true);
    fetch(`/api/leaderboard/top5?section=${section}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error?.message ?? "데이터를 불러오지 못했습니다.");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError("네트워크 오류가 발생했습니다.");
          console.error("Leaderboard top5 fetch error:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  return (
    <Card className={cn("overflow-hidden border-border bg-card", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="truncate text-base">
          보팅맨 TOP5 랭커 실시간 포지션
        </CardTitle>
        <p className="truncate text-xs text-muted-foreground">시장별 MMR 기준 TOP5 · 오늘 투표 포지션</p>
      </CardHeader>
      <CardContent className="overflow-hidden space-y-4">
        {isLoading && (
          <div className="space-y-2 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-md bg-muted/50"
              />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && data && data.top5.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            아직 해당 시장 랭커가 없습니다.
          </p>
        )}

        {!isLoading && !error && data && data.top5.length > 0 && activeTab === "btc" && (
          <PositionsSection title="비트코인 시장 투표 기준" rows={toPositionRows(data.top5, "btc")} />
        )}

        {!isLoading && !error && data && data.top5.length > 0 && activeTab === "us" && (
          <>
            <PositionsSection title="나스닥 지수 시장 투표 기준" rows={toPositionRows(data.top5, "ndq")} />
            <div className="h-px bg-border/60" />
            <PositionsSection title="S&P500 지수 시장 투표 기준" rows={toPositionRows(data.top5, "sp500")} />
          </>
        )}

        {!isLoading && !error && data && data.top5.length > 0 && activeTab === "kr" && (
          <>
            <PositionsSection title="코스피 지수 시장 투표 기준" rows={toPositionRows(data.top5, "kospi")} />
            <div className="h-px bg-border/60" />
            <PositionsSection title="코스닥 지수 시장 투표 기준" rows={toPositionRows(data.top5, "kosdaq")} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
