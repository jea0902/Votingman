"use client";

import { cn } from "@/lib/utils";

interface RatioData {
  longAccount: string;
  shortAccount: string;
  longShortRatio: string;
}

interface LongShortRatioProps {
  btc: RatioData | null;
  eth: RatioData | null;
  whaleBtc: RatioData | null;
  whaleEth: RatioData | null;
  className?: string;
}

function RatioBar({
  label,
  symbol,
  data,
  badge,
}: {
  label: string;
  symbol: string;
  data: RatioData | null;
  badge?: string;
}) {
  if (!data) return null;

  const longPct = (parseFloat(data.longAccount) * 100).toFixed(1);
  const shortPct = (parseFloat(data.shortAccount) * 100).toFixed(1);
  const longNum = parseFloat(longPct);
  const isBullish = longNum >= 50;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{symbol}</span>
          {badge && (
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        <span className={cn(
          "text-xs font-medium",
          isBullish ? "text-emerald-500" : "text-rose-500"
        )}>
          {isBullish ? "▲" : "▼"} {isBullish ? "롱 우세" : "숏 우세"}
        </span>
      </div>

      {/* 막대 그래프 */}
      <div className="relative h-7 overflow-hidden rounded-md">
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start bg-emerald-500/80 pl-2 transition-all duration-500"
          style={{ width: `${longNum}%` }}
        >
          <span className="text-[11px] font-bold text-white drop-shadow">
            LONG {longPct}%
          </span>
        </div>
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end bg-rose-500/80 pr-2 transition-all duration-500"
          style={{ width: `${100 - longNum}%` }}
        >
          <span className="text-[11px] font-bold text-white drop-shadow">
            SHORT {shortPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function LongShortRatio({
  btc,
  eth,
  whaleBtc,
  whaleEth,
  className,
}: LongShortRatioProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>
      {/* 전체 유저 롱/숏 비율 */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-400" />
          <h3 className="text-sm font-semibold text-foreground">롱/숏 비율</h3>
          <span className="text-xs text-muted-foreground">전체 유저</span>
        </div>
        <div className="space-y-3">
          <RatioBar label="BTC" symbol="BTC" data={btc} />
          <RatioBar label="ETH" symbol="ETH" data={eth} />
        </div>
      </div>

      {/* 고래 롱/숏 비율 */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">고래 롱/숏 비율</h3>
          <span className="text-xs text-muted-foreground">상위 트레이더</span>
        </div>
        <div className="space-y-3">
          <RatioBar label="BTC" symbol="BTC" data={whaleBtc} badge="고래" />
          <RatioBar label="ETH" symbol="ETH" data={whaleEth} badge="고래" />
        </div>
      </div>
    </div>
  );
}