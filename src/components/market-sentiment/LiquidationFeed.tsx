"use client";

import { cn } from "@/lib/utils";

interface LiquidationOrder {
  symbol: string;
  side: string;
  origQty: string;
  price: string;
  averagePrice: string;
  status: string;
  time: number;
}

interface LiquidationFeedProps {
  data: LiquidationOrder[];
  className?: string;
}

const KRW_RATE = 1440; // 대략적인 환율 (실제로는 환율 API 연동 권장)

function formatTime(timestamp: number) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}

function formatUsd(qty: string, price: string) {
  const value = parseFloat(qty) * parseFloat(price);
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatKrw(qty: string, price: string) {
  const usd = parseFloat(qty) * parseFloat(price);
  const krw = usd * KRW_RATE;
  if (krw >= 1_000_000_000) return `약 ${(krw / 1_000_000_000).toFixed(1)}십억원`;
  if (krw >= 100_000_000) return `약 ${(krw / 100_000_000).toFixed(1)}억원`;
  if (krw >= 10_000_000) return `약 ${(krw / 10_000_000).toFixed(0)}천만원`;
  return `약 ${Math.round(krw / 10_000)}만원`;
}

export function LiquidationFeed({ data, className }: LiquidationFeedProps) {
  const items = data.slice(0, 10);

  return (
    <div className={cn("rounded-xl border border-border bg-muted/20 p-4", className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <h3 className="text-sm font-semibold text-foreground">최근 BTC 청산 내역</h3>
        </div>
        <span className="text-xs text-muted-foreground">바이낸스 공식 · 1건 단위</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          최근 청산 내역이 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((order, i) => {
            const isLongLiquidated = order.side === "SELL";
            const execPrice = order.averagePrice || order.price;
            const usdValue = formatUsd(order.origQty, execPrice);
            const krwValue = formatKrw(order.origQty, execPrice);
            const rawUsd = parseFloat(order.origQty) * parseFloat(execPrice);
            const isLarge = rawUsd > 500_000; // 1건 청산 $500K = 약 7.2억원 이상

            return (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2.5 transition-colors",
                  isLongLiquidated
                    ? "border border-rose-500/20 bg-rose-500/5"
                    : "border border-emerald-500/20 bg-emerald-500/5",
                  isLarge && "ring-1 ring-amber-400/40"
                )}
              >
                <div className="flex items-center justify-between">
                  {/* 왼쪽: 청산 종류 + 가격 */}
                  <div className="flex items-center gap-2">
                    {isLarge && (
                      <span className="text-sm">🐋</span>
                    )}
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-bold",
                      isLongLiquidated
                        ? "bg-rose-500/20 text-rose-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    )}>
                      {isLongLiquidated ? "LONG 청산" : "SHORT 청산"}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      @${parseFloat(execPrice).toLocaleString()}
                    </span>
                  </div>

                  {/* 오른쪽: 시간 */}
                  <span className="text-xs text-muted-foreground">
                    {formatTime(order.time)}
                  </span>
                </div>

                {/* 금액 (달러 + 한화) */}
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className={cn(
                    "font-bold tabular-nums",
                    isLongLiquidated ? "text-rose-400" : "text-emerald-400"
                  )}>
                    {usdValue}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ({krwValue})
                  </span>
                  {isLarge && (
                    <span className="text-[10px] text-amber-400 font-medium">
                      · 대형 청산
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground/60">
        * 1건 = 하나의 포지션이 강제청산된 금액 · 🐋 $500K(약 7.2억원) 이상 대형 청산
        · LONG 청산: 하락 압력 / SHORT 청산: 상승 압력 · 환율 약 1,440원 기준
      </p>
    </div>
  );
}