"use client";

/**
 * 투표 보상 페이지용 TOP 30 랭킹 테이블
 * - 1~10위: 선물하기 3만원권 + 명예 배지
 * - 11~30위: 명예 배지
 */

import { useEffect, useState } from "react";
import { Medal, Award, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeaderboardTop20Item, LeaderboardTop20Response } from "@/app/api/leaderboard/top20/route";

export function RewardsTop30Table({ className }: { className?: string }) {
  const [data, setData] = useState<LeaderboardTop20Response | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
      .catch(() => {
        if (!cancelled) setError("네트워크 오류가 발생했습니다.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const rows = data?.top20 ?? [];

  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardContent className="pt-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">현재 랭킹 TOP 30</h3>

        {isLoading && (
          <div className="space-y-2 py-4">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">아직 랭커가 없습니다.</p>
        )}

        {!isLoading && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">순위</th>
                  <th className="max-w-[100px] pb-2 pr-2 font-medium">닉네임</th>
                  <th className="pb-2 pr-2 font-medium">시장</th>
                  <th className="pb-2 pr-2 font-medium">포지션</th>
                  <th className="pb-2 pr-2 font-medium text-right">누적 승률</th>
                  <th className="pb-2 pr-2 font-medium text-right">배팅 VTC</th>
                  <th className="pb-2 pr-2 font-medium text-right">MMR</th>
                  <th className="pb-2 font-medium">보상</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item: LeaderboardTop20Item) => {
                  const pp = item.primary_position;
                  const choice = pp?.choice ?? "long";
                  const betAmount = pp?.bet_amount ?? 0;
                  const marketLabel = pp?.market_label ?? "-";
                  const winRate =
                    typeof item.win_rate === "number" ? `${Number(item.win_rate).toFixed(2)}%` : "-";
                  return (
                    <tr
                      key={item.user_id}
                      className={cn(
                        "border-b border-border/60 last:border-0",
                        item.rank <= 10 && "bg-muted/20"
                      )}
                    >
                      <td className="py-2.5 pr-2">
                        <span className="inline-flex items-center gap-1 font-medium tabular-nums text-muted-foreground">
                          {item.rank <= 3 && (
                            <Medal
                              className={cn(
                                "h-4 w-4 shrink-0",
                                item.rank === 1 && "text-amber-400",
                                item.rank === 2 && "text-slate-400",
                                item.rank === 3 && "text-amber-700"
                              )}
                            />
                          )}
                          {item.rank}위
                        </span>
                      </td>
                      <td className="max-w-[100px] truncate py-2.5 pr-2 font-medium" title={item.nickname}>
                        {item.nickname}
                      </td>
                      <td className="max-w-[80px] truncate py-2.5 pr-2 text-xs text-muted-foreground" title={marketLabel}>
                        {betAmount > 0 ? marketLabel : "-"}
                      </td>
                      <td className="py-2.5 pr-2">
                        <span
                          className={cn(
                            "inline-block rounded px-1.5 py-0.5 text-xs font-bold",
                            betAmount === 0 && "bg-muted text-muted-foreground",
                            betAmount > 0 && choice === "long" && "bg-emerald-500/20 text-emerald-500",
                            betAmount > 0 && choice === "short" && "bg-rose-500/20 text-rose-500"
                          )}
                        >
                          {betAmount === 0 ? "-" : choice === "long" ? "롱" : "숏"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-right text-xs tabular-nums text-muted-foreground">
                        {winRate}
                      </td>
                      <td className="py-2.5 pr-2 text-right text-xs tabular-nums text-muted-foreground">
                        {betAmount === 0 ? "-" : `${Number(betAmount).toFixed(2)} VTC`}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">{item.mmr.toLocaleString()}</td>
                      <td className="py-2.5">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {item.rank <= 10 && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                              <Gift className="h-3.5 w-3.5" />
                              선물하기 3만원권
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <Award className="h-3.5 w-3.5" />
                            명예 배지
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
