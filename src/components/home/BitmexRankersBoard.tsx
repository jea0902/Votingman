"use client";

/**
 * 비트멕스 선물 랭커 TOP3 실시간 포지션
 *
 * 설계 의도:
 * - 비트멕스 선물 거래소의 TOP3 랭커 실시간 포지션 표시
 * - 비트멕스 API 연동 예정. 현재는 샘플 데이터 표시.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BitmexRankerItem {
  rank: number;
  name: string;
  position: "long" | "short";
  symbol: string;
  pnlPercent: number;
}

/** 외부 API 연동 전까지 샘플 데이터 (UI 미리보기용). 비트멕스 API 연동 필요 */
const SAMPLE_BITMEX_RANKERS: BitmexRankerItem[] = [
  { rank: 1, name: "bitmex_whale_01", position: "long", symbol: "XBTUSD", pnlPercent: 15.3 },
  { rank: 2, name: "crypto_master", position: "short", symbol: "ETHUSD", pnlPercent: 9.8 },
  { rank: 3, name: "futures_king", position: "long", symbol: "XBTUSD", pnlPercent: 7.1 },
];

function PnlBadge({ pnl }: { pnl: number }) {
  const isPositive = pnl >= 0;
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium tabular-nums",
        isPositive ? "bg-chart-2/20 text-chart-2" : "bg-chart-4/20 text-chart-4"
      )}
    >
      {isPositive ? "+" : ""}{pnl}%
    </span>
  );
}

function RankerCard({ ranker }: { ranker: BitmexRankerItem }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "shrink-0 text-xs font-medium tabular-nums",
            ranker.rank === 1 && "text-amber-400",
            ranker.rank === 2 && "text-slate-400",
            ranker.rank === 3 && "text-amber-700",
            ranker.rank > 3 && "text-muted-foreground"
          )}
        >
          {ranker.rank}위
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{ranker.name}</span>
      </div>
      <div className="mt-1 flex min-w-0 items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs text-muted-foreground">{ranker.symbol}</span>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-bold",
              ranker.position === "long"
                ? "bg-chart-2/20 text-chart-2"
                : "bg-chart-4/20 text-chart-4"
            )}
          >
            {ranker.position === "long" ? "LONG" : "SHORT"}
          </span>
        </div>
        <PnlBadge pnl={ranker.pnlPercent} />
      </div>
    </div>
  );
}

export function BitmexRankersBoard({ className }: { className?: string }) {
  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">비트멕스 선물 랭커 TOP3 - 실시간 포지션</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_BITMEX_RANKERS.map((r) => (
            <RankerCard key={r.rank} ranker={r} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
