"use client";

/**
 * AI 리더보드
 * - ChatGPT, Gemini, Claude, Grok 4개 모델의 누적 승률, MMR, 순위 표시
 * - 실시간 갱신 느낌 (더미데이터)
 */

import { Medal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AILeaderboardItem = {
  id: string;
  name: string;
  rank: number;
  mmr: number;
  winRate: number;
  color: string;
};

/** 더미 데이터 - 추후 API 연동 시 교체 */
const DUMMY_AI_LEADERBOARD: AILeaderboardItem[] = [
  { id: "chatgpt", name: "ChatGPT", rank: 1, mmr: 2450, winRate: 62.5, color: "text-emerald-500" },
  { id: "gemini", name: "Gemini", rank: 2, mmr: 2380, winRate: 59.8, color: "text-blue-500" },
  { id: "claude", name: "Claude", rank: 3, mmr: 2290, winRate: 57.2, color: "text-amber-500" },
  { id: "grok", name: "Grok", rank: 4, mmr: 2150, winRate: 54.1, color: "text-slate-400" },
];

export function AILeaderboard() {
  const rows = DUMMY_AI_LEADERBOARD;

  return (
    <Card className="min-w-0 overflow-hidden rounded-xl border-border bg-muted/20">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-4 sm:px-5">
          <h3 className="text-base font-semibold text-foreground">
            AI 리더보드
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            실시간
          </span>
        </div>

        {/* 컬럼 헤더 - 데스크톱 */}
        <div className="hidden grid-cols-[3rem_1fr_6rem_5rem] gap-4 border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid sm:px-5">
          <span>순위</span>
          <span>AI 모델</span>
          <span className="text-right">MMR</span>
          <span className="text-right">누적승률</span>
        </div>

        <div className="space-y-3 px-4 pb-4 sm:space-y-0 sm:divide-y sm:divide-border sm:px-0 sm:pb-0">
          {rows.map((item) => (
            <div
              key={item.id}
              className={cn(
                "min-w-0 overflow-hidden rounded-lg border border-border p-4 sm:border-0 sm:rounded-none sm:grid sm:p-0 sm:py-3 sm:px-5 sm:grid-cols-[3rem_1fr_6rem_5rem] sm:items-center sm:gap-4",
                item.rank <= 3 && "bg-muted/10"
              )}
            >
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
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white",
                      item.id === "chatgpt" && "from-emerald-500 to-emerald-700",
                      item.id === "gemini" && "from-blue-500 to-blue-700",
                      item.id === "claude" && "from-amber-500 to-amber-700",
                      item.id === "grok" && "from-slate-500 to-slate-700"
                    )}
                  >
                    {item.name.charAt(0)}
                  </div>
                  <span className={cn("min-w-0 truncate text-sm font-semibold", item.color)}>
                    {item.name}
                  </span>
                </div>
              </div>

              <div className="mb-2 flex items-center justify-between sm:mb-0 sm:block sm:text-right">
                <span className="text-xs text-muted-foreground sm:hidden">MMR</span>
                <span className="text-sm tabular-nums font-medium text-foreground">
                  {item.mmr.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between sm:block sm:text-right">
                <span className="text-xs text-muted-foreground sm:hidden">누적승률</span>
                <span className="text-sm tabular-nums font-medium text-foreground">
                  {item.winRate.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
