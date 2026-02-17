"use client";

/**
 * 워뇨띠(aoa) 선물 - 실시간 포지션
 *
 * 설계 의도:
 * - 워뇨띠(aoa)의 현재 선물 포지션 표시
 * - 크롤러/연동 API 연동 예정. 현재는 샘플 데이터 표시.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WonyottiPosition {
  symbol: string;
  position: "Long" | "Short";
  entryPrice: number;
  marketPrice: number;
  pnlUsdt: number;
  pnlPercent: number;
  leverage: number;
  isLive: boolean;
}

/** 크롤러/API 연동 전까지 샘플 데이터 (UI 미리보기용) */
const SAMPLE_WONYOTTI: WonyottiPosition = {
  symbol: "BTCUSDT",
  position: "Long",
  entryPrice: 68500.0,
  marketPrice: 70837.89,
  pnlUsdt: 233789.0,
  pnlPercent: 3.41,
  leverage: 10,
  isLive: true,
};

function PnlBadge({ pnl }: { pnl: number }) {
  const isPositive = pnl >= 0;
  return (
    <span
      className={cn(
        "inline-flex rounded px-2 py-1 text-sm font-bold tabular-nums",
        isPositive ? "bg-chart-2/20 text-chart-2" : "bg-chart-4/20 text-chart-4"
      )}
    >
      {isPositive ? "+" : ""}{pnl.toFixed(2)}%
    </span>
  );
}

export function WonyottiPosition({ className }: { className?: string }) {
  const data = SAMPLE_WONYOTTI;
  const isProfit = data.pnlUsdt > 0;
  const isLoss = data.pnlUsdt < 0;

  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">워뇨띠(aoa) 선물 - 실시간 포지션</CardTitle>
      </CardHeader>
      <CardContent>
        {data.isLive ? (
          <div className="space-y-4">
            {/* 메인 포지션 정보 */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-chart-2/20 text-lg font-bold text-foreground">
                    AOA
                  </div>
                  <div>
                    <div className="text-base font-semibold text-foreground">워뇨띠</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{data.symbol}</span>
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-bold",
                          data.position === "Long"
                            ? "bg-chart-2/20 text-chart-2"
                            : "bg-chart-4/20 text-chart-4"
                        )}
                      >
                        {data.position}
                      </span>
                      <span className="text-xs">×{data.leverage}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-xs text-muted-foreground">미실현 손익</div>
                  <div
                    className={cn(
                      "text-xl font-bold tabular-nums",
                      isProfit && "text-chart-2",
                      isLoss && "text-chart-4",
                      !isProfit && !isLoss && "text-muted-foreground"
                    )}
                  >
                    {isProfit ? "+" : ""}
                    {data.pnlUsdt.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                    <span className="ml-2 text-base">USDT</span>
                  </div>
                  <div className="mt-1">
                    <PnlBadge pnl={data.pnlPercent} />
                  </div>
                </div>
              </div>

              {/* 가격 정보 그리드 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded bg-background/50 px-3 py-2">
                  <div className="mb-1 text-xs text-muted-foreground">진입가</div>
                  <div className="text-sm font-semibold tabular-nums text-foreground">
                    {data.entryPrice >= 10000
                      ? `${(data.entryPrice / 1000).toFixed(1)}K`
                      : data.entryPrice.toLocaleString()}
                  </div>
                </div>
                <div className="rounded bg-background/50 px-3 py-2">
                  <div className="mb-1 text-xs text-muted-foreground">시장가</div>
                  <div className="text-sm font-semibold tabular-nums text-foreground">
                    {data.marketPrice >= 10000
                      ? `${(data.marketPrice / 1000).toFixed(1)}K`
                      : data.marketPrice.toLocaleString()}
                  </div>
                </div>
                <div className="rounded bg-background/50 px-3 py-2">
                  <div className="mb-1 text-xs text-muted-foreground">청산가</div>
                  <div className="text-sm font-semibold tabular-nums text-foreground">
                    {data.position === "Long"
                      ? data.entryPrice * (1 - 0.9 / data.leverage) >= 10000
                        ? `${((data.entryPrice * (1 - 0.9 / data.leverage)) / 1000).toFixed(1)}K`
                        : (data.entryPrice * (1 - 0.9 / data.leverage)).toFixed(2)
                      : data.entryPrice * (1 + 0.9 / data.leverage) >= 10000
                        ? `${((data.entryPrice * (1 + 0.9 / data.leverage)) / 1000).toFixed(1)}K`
                        : (data.entryPrice * (1 + 0.9 / data.leverage)).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            포지션 정보 없음
          </div>
        )}
      </CardContent>
    </Card>
  );
}
