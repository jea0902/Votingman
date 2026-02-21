"use client";

/**
 * 바이낸스 선물 랭커 TOP3 실시간 포지션
 *
 * 설계 의도:
 * - 사이드바 하단에 배치, 롱/숏 비율·수익률 시각화
 * - 바이낸스 공식 API에는 리더보드 엔드포인트가 없음. 서드파티 API 또는 스크래핑 필요.
 *   - 현재는 샘플 데이터 표시.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RankerItem {
  rank: number;
  name: string;
  position: "long" | "short";
  symbol: string;
  pnlPercent: number;
}

/** 외부 API 연동 전까지 샘플 데이터 (UI 미리보기용). 바이낸스 API 리더보드 미제공 → 서드파티 필요 */
const SAMPLE_RANKERS: RankerItem[] = [
  { rank: 1, name: "trader_alpha", position: "long", symbol: "BTCUSDT", pnlPercent: 12.4 },
  { rank: 2, name: "whale_42", position: "short", symbol: "ETHUSDT", pnlPercent: 8.7 },
  { rank: 3, name: "crypto_bull", position: "long", symbol: "BTCUSDT", pnlPercent: 6.2 },
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

function RankerCard({ ranker }: { ranker: RankerItem }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "shrink-0 text-xs font-medium tabular-nums",
            ranker.rank === 1 && "text-amber-700 dark:text-amber-400",
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

export function TopRankersBoard({ className }: { className?: string }) {
  return (
    <Card className={cn("min-w-0 overflow-hidden border-border bg-muted/20", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">바이낸스 선물 랭커 TOP3 - 실시간 포지션</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_RANKERS.map((r) => (
            <RankerCard key={r.rank} ranker={r} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
