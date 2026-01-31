"use client";

/**
 * 실시간 비트멕스 상위 랭커 포지션 현황판
 *
 * 설계 의도:
 * - 사이드바 하단에 배치, 롱/숏 비율·수익률 등 더미 데이터 시각화
 * - Deep Dark 테마, 롱=녹색/숏=빨강 등 직관적 색상
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RankerItem {
  rank: number;
  name: string;
  position: "long" | "short";
  symbol: string;
  pnlPercent: number;
}

const DUMMY_RANKERS: RankerItem[] = [
  { rank: 1, name: "trader_alpha", position: "long", symbol: "BTCUSDT", pnlPercent: 12.4 },
  { rank: 2, name: "whale_42", position: "short", symbol: "ETHUSDT", pnlPercent: 8.7 },
  { rank: 3, name: "crypto_bull", position: "long", symbol: "BTCUSDT", pnlPercent: 6.2 },
  { rank: 4, name: "bear_market", position: "short", symbol: "BTCUSDT", pnlPercent: 5.1 },
  { rank: 5, name: "hodl_master", position: "long", symbol: "ETHUSDT", pnlPercent: 4.3 },
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

const longCount = DUMMY_RANKERS.filter((r) => r.position === "long").length;
const longPct = Math.round((longCount / DUMMY_RANKERS.length) * 100);
const shortPct = 100 - longPct;

export function TopRankersBoard({ className }: { className?: string }) {
  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">비트멕스 리더보드 상위 랭커 실시간 포지션</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          롱/숏 비율 및 수익률 (더미)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-2 rounded-md border border-border bg-muted/30 p-2 text-center text-xs">
          <span className="flex-1 rounded bg-chart-2/20 px-2 py-1 font-medium text-chart-2">
            롱 {longPct}%
          </span>
          <span className="flex-1 rounded bg-chart-4/20 px-2 py-1 font-medium text-chart-4">
            숏 {shortPct}%
          </span>
        </div>
        <div className="space-y-2">
          {DUMMY_RANKERS.map((r) => (
            <div
              key={r.rank}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <span className="w-5 shrink-0 font-medium text-muted-foreground">
                #{r.rank}
              </span>
              <span className="min-w-0 truncate font-medium text-foreground">
                {r.name}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                  r.position === "long"
                    ? "bg-chart-2/20 text-chart-2"
                    : "bg-chart-4/20 text-chart-4"
                )}
              >
                {r.position === "long" ? "L" : "S"}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {r.symbol}
              </span>
              <PnlBadge pnl={r.pnlPercent} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
