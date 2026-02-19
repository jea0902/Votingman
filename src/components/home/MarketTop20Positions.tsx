"use client";

/**
 * 보팅맨 통합 TOP20 랭커 실시간 포지션
 * - 통합 MMR TOP20 노출 (리더보드 페이지)
 * - 유저당 1개 시장만 표시: 해당 유저가 가장 많이 배팅한 시장 + 롱/숏 + 배팅 VTC
 */

import { useEffect, useState } from "react";
import { Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeaderboardTop20Item, LeaderboardTop20Response } from "@/app/api/leaderboard/top20/route";

type PositionRow = {
  rank: number;
  nickname: string;
  winRate: number;
  choice: "long" | "short";
  betAmount: number;
  marketLabel: string;
};

function toPositionRows(items: LeaderboardTop20Item[]): PositionRow[] {
  return items.map((item) => {
    const pp = item.primary_position;
    return {
      rank: item.rank,
      nickname: item.nickname,
      winRate: item.win_rate,
      choice: pp?.choice ?? "long",
      betAmount: pp?.bet_amount ?? 0,
      marketLabel: pp?.market_label ?? "-",
    };
  });
}

function PositionsSection({ rows }: { rows: PositionRow[] }) {
  return (
    <section className="w-fit min-w-full space-y-2">
      <div className="grid grid-cols-[3rem_7rem_5rem_4rem_4.5rem_7rem] justify-items-start gap-2 px-3 pb-1.5 text-xs font-medium text-muted-foreground">
        <span className="text-left">순위</span>
        <span className="mr-2 min-w-0 overflow-hidden text-ellipsis text-left">닉네임</span>
        <span className="text-left">시장</span>
        <span>포지션</span>
        <span className="justify-self-end text-right">누적 승률</span>
        <span className="justify-self-end text-right">배팅 VTC</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.rank}
            className="grid min-w-0 grid-cols-[3rem_7rem_5rem_4rem_4.5rem_7rem] items-center justify-items-start gap-2 overflow-hidden rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
          >
            <span className="flex shrink-0 items-center gap-1 text-left font-medium text-muted-foreground tabular-nums">
              {row.rank <= 3 && (
                <Medal
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    row.rank === 1 && "text-amber-700 dark:text-amber-400",
                    row.rank === 2 && "text-slate-400",
                    row.rank === 3 && "text-amber-700"
                  )}
                />
              )}
              {row.rank}위
            </span>
            <span
              className="mr-2 min-w-0 overflow-hidden text-ellipsis font-medium text-foreground"
              title={row.nickname}
            >
              {row.nickname.length > 10 ? `${row.nickname.slice(0, 10)}…` : row.nickname}
            </span>
            <span
              className="min-w-0 shrink-0 overflow-hidden text-ellipsis text-left text-xs text-muted-foreground"
              title={row.marketLabel}
            >
              {row.betAmount > 0 ? row.marketLabel : "-"}
            </span>
            <span
              className={cn(
                "shrink-0 justify-self-start rounded px-1.5 py-0.5 text-center text-xs font-bold",
                row.betAmount === 0 && "bg-muted text-muted-foreground",
                row.betAmount > 0 && row.choice === "long" && "bg-emerald-500/20 text-emerald-500",
                row.betAmount > 0 && row.choice === "short" && "bg-rose-500/20 text-rose-500"
              )}
            >
              {row.betAmount === 0 ? "-" : row.choice === "long" ? "롱" : "숏"}
            </span>
            <span className="shrink-0 justify-self-end text-right text-xs font-semibold tabular-nums text-red-500">
              {typeof row.winRate === "number" ? `${Number(row.winRate).toFixed(2)}%` : "-"}
            </span>
            <span className="shrink-0 justify-self-end text-right text-xs tabular-nums text-muted-foreground">
              {row.betAmount === 0 ? "-" : `${Number(row.betAmount).toFixed(2)} VTC`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MarketTop20Positions({ className }: { className?: string }) {
  const [data, setData] = useState<LeaderboardTop20Response | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setError(null);
        setIsLoading(true);
      }
    });
    fetch("/api/leaderboard/top20")
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
          console.error("Leaderboard top20 fetch error:", err);
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
          보팅맨 TOP 20 랭커 - 실시간 포지션 (현재 최다 배팅 포지션)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          랭킹은 MMR 점수(보유 코인 수 × 누적 승률)에 따라 순위가 매겨짐
        </p>
      </CardHeader>
      <CardContent className="overflow-hidden space-y-4">
        {isLoading && (
          <div className="space-y-2 py-2">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && data && (!data.top20 || data.top20.length === 0) && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            아직 랭커가 없습니다.
          </p>
        )}

        {!isLoading && !error && data && data.top20.length > 0 && (
          <PositionsSection rows={toPositionRows(data.top20)} />
        )}
      </CardContent>
    </Card>
  );
}
