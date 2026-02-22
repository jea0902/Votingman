"use client";

/**
 * 통합 TOP 30 랭커 (Polymarket 스타일)
 * - 순위, 닉네임, MMR, 누적승률만 표시
 * - 리더보드 페이지용
 */

import { useEffect, useState } from "react";
import { Medal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeaderboardTop30Item, LeaderboardTop30Response } from "@/app/api/leaderboard/top30/route";

type Props = {
  variant?: "leaderboard" | "positions";
  className?: string;
};

/** 순위별 아바타 그라디언트 색상 */
const AVATAR_GRADIENTS = [
  "from-amber-500/80 to-orange-600",
  "from-slate-400 to-slate-600",
  "from-amber-600 to-amber-800",
  "from-emerald-500/80 to-cyan-600",
  "from-violet-500/80 to-purple-600",
  "from-rose-500/80 to-pink-600",
  "from-blue-500/80 to-indigo-600",
] as const;

function getAvatarGradient(rank: number) {
  return AVATAR_GRADIENTS[(rank - 1) % AVATAR_GRADIENTS.length];
}

export function MarketTop30Positions({ variant = "leaderboard", className }: Props) {
  const [data, setData] = useState<LeaderboardTop30Response | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard/top30")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error?.message ?? "데이터를 불러오지 못했습니다.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("네트워크 오류가 발생했습니다.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const rows = data?.top30 ?? [];

  return (
    <Card className={cn("min-w-0 overflow-hidden rounded-xl border-border bg-muted/20", className)}>
      <CardContent className="p-0">
        <h3 className="px-4 py-4 text-base font-semibold text-foreground sm:px-5">
          현재 랭킹 TOP 30
        </h3>

        {isLoading && (
          <div className="space-y-1 px-4 py-4 sm:px-5">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex h-14 animate-pulse items-center gap-4 rounded-lg bg-muted/40" />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4 mx-4 mb-4 text-sm text-destructive sm:mx-5 sm:mb-5">
            {error}
          </div>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">아직 랭커가 없습니다.</p>
        )}

        {!isLoading && !error && rows.length > 0 && (
          <>
            {/* 컬럼 헤더 - 데스크톱 */}
            <div className="hidden grid-cols-[3rem_1fr_6rem_5rem] gap-4 border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid sm:px-5">
              <span>순위</span>
              <span>닉네임</span>
              <span className="text-right">MMR</span>
              <span className="text-right">누적승률</span>
            </div>

            <div className="space-y-3 px-4 pb-4 sm:space-y-0 sm:divide-y sm:divide-border sm:px-0 sm:pb-0">
              {rows.map((item: LeaderboardTop30Item) => {
                const winRate =
                  typeof item.win_rate === "number" ? `${Number(item.win_rate).toFixed(2)}%` : "-";
                const initial = (item.nickname || "?").charAt(0).toUpperCase();
                return (
                  <div
                    key={item.user_id}
                    className={cn(
                      "min-w-0 overflow-hidden rounded-lg border border-border p-4 sm:border-0 sm:rounded-none sm:grid sm:p-0 sm:py-3 sm:px-5 sm:grid-cols-[3rem_1fr_6rem_5rem] sm:items-center sm:gap-4",
                      item.rank <= 3 && "bg-muted/10"
                    )}
                  >
                    {/* 순위 + 아바타 + 닉네임 (모바일: 순위 옆에 아바타·닉네임 한 줄) */}
                    <div className="mb-3 flex min-w-0 items-center gap-2 sm:mb-0 sm:contents">
                      <div className="flex shrink-0 items-center gap-1.5">
                        {item.rank <= 3 && (
                          <Medal
                            className={cn(
                              "h-4 w-4 shrink-0",
                              item.rank === 1 && "text-amber-500",
                              item.rank === 2 && "text-slate-400",
                              item.rank === 3 && "text-amber-700 dark:text-amber-600"
                            )}
                          />
                        )}
                        <span className="tabular-nums font-medium text-foreground">{item.rank}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white",
                            getAvatarGradient(item.rank)
                          )}
                        >
                          {initial}
                        </div>
                        <span className="min-w-0 truncate text-sm font-medium text-foreground" title={item.nickname}>
                          {item.nickname || "-"}
                        </span>
                      </div>
                    </div>

                    {/* MMR - 모바일에서 라벨 표시 */}
                    <div className="mb-2 flex items-center justify-between sm:mb-0 sm:block sm:text-right">
                      <span className="text-xs text-muted-foreground sm:hidden">MMR</span>
                      <span className="text-sm tabular-nums font-medium text-foreground">
                        {item.mmr.toLocaleString()}
                      </span>
                    </div>

                    {/* 누적승률 */}
                    <div className="flex items-center justify-between sm:block sm:text-right">
                      <span className="text-xs text-muted-foreground sm:hidden">누적승률</span>
                      <span className="text-sm tabular-nums text-muted-foreground">{winRate}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
