"use client";

/**
 * 보팅맨 통합 TOP5 랭커 실시간 포지션
 * - 통합 MMR TOP5 한 개만 노출
 * - 유저당 1개 시장만 표시: 해당 유저가 가장 많이 배팅한 시장 + 롱/숏 + 배팅 VTC
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeaderboardTop5Item, LeaderboardTop5Response } from "@/app/api/leaderboard/top5/route";

type PositionRow = {
  rank: number;
  nickname: string;
  choice: "long" | "short";
  betAmount: number;
  marketLabel: string;
};

function toPositionRows(top5: LeaderboardTop5Item[]): PositionRow[] {
  return top5.map((item) => {
    const pp = item.primary_position;
    return {
      rank: item.rank,
      nickname: item.nickname,
      choice: pp?.choice ?? "long",
      betAmount: pp?.bet_amount ?? 0,
      marketLabel: pp?.market_label ?? "-",
    };
  });
}

function PositionsSection({ rows }: { rows: PositionRow[] }) {
  return (
    <section className="space-y-2">
      <div className="grid grid-cols-[auto_1fr_4rem_8rem] gap-2 px-3 pb-1.5 text-xs font-medium text-muted-foreground">
        <span className="text-right">순위</span>
        <span className="min-w-0 overflow-hidden text-ellipsis">닉네임</span>
        <span className="text-center">포지션</span>
        <span className="text-right">시장 · 배팅 VTC</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.rank}
            className="grid min-w-0 grid-cols-[auto_1fr_4rem_8rem] items-center gap-2 overflow-hidden rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
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
              {row.betAmount === 0 ? "-" : `${row.marketLabel} ${row.betAmount.toLocaleString()} VTC`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MarketTop5Positions({ className }: { className?: string }) {
  const [data, setData] = useState<LeaderboardTop5Response | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setIsLoading(true);
    fetch("/api/leaderboard/top5")
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
  }, []);

  return (
    <Card className={cn("overflow-hidden border-border bg-card", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="truncate text-base">
          보팅맨 TOP5 랭커 실시간 포지션
        </CardTitle>
        <p className="truncate text-xs text-muted-foreground">
          통합 랭킹 TOP5 · 유저당 최다배팅 시장 1개
        </p>
      </CardHeader>
      <CardContent className="overflow-hidden space-y-4">
        {isLoading && (
          <div className="space-y-2 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted/50" />
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
            아직 랭커가 없습니다.
          </p>
        )}

        {!isLoading && !error && data && data.top5.length > 0 && (
          <PositionsSection rows={toPositionRows(data.top5)} />
        )}
      </CardContent>
    </Card>
  );
}
