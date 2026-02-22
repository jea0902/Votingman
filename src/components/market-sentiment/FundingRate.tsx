"use client";

import { cn } from "@/lib/utils";

interface PremiumIndexData {
  symbol: string;
  markPrice: string;
  lastFundingRate: string;       // 마지막 정산 펀딩률
  nextFundingTime: number;       // 다음 정산 시각 (ms)
  time: number;
}

interface FundingRateProps {
  btc: PremiumIndexData | null;
  eth: PremiumIndexData | null;
  xrp: PremiumIndexData | null;
  className?: string;
}

function formatNextFunding(nextFundingTime: number) {
  const now = Date.now();
  const diff = nextFundingTime - now;
  if (diff <= 0) return "정산 중";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}시간 ${minutes}분 후 정산`;
  return `${minutes}분 후 정산`;
}

function FundingCard({ symbol, data }: { symbol: string; data: PremiumIndexData | null }) {
  if (!data) return null;

  const rate = parseFloat(data.lastFundingRate) * 100;
  const isPositive = rate >= 0;
  const absRate = Math.abs(rate);
  const nextFunding = formatNextFunding(data.nextFundingTime);

  return (
    <div className="flex-1 rounded-lg border border-border bg-background/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{symbol}/USDT</span>
      </div>

      {/* 펀딩률 */}
      <div className={cn(
        "text-xl font-bold tabular-nums tracking-tight",
        isPositive ? "text-emerald-500" : "text-rose-500"
      )}>
        {isPositive ? "+" : ""}{rate.toFixed(4)}%
      </div>

      {/* 다음 정산까지 */}
      <div className="text-[11px] text-amber-400 font-medium">
        ⏱ {nextFunding}
      </div>

      {/* 의미 설명 */}
      <div className="text-[11px] text-muted-foreground">
        {isPositive ? "롱→숏 지급 (롱 과열)" : "숏→롱 지급 (숏 과열)"}
      </div>

      {/* 강도 바 */}
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isPositive ? "bg-emerald-500" : "bg-rose-500"
          )}
          style={{ width: `${Math.min(absRate / 0.15 * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function FundingRate({ btc, eth, xrp, className }: FundingRateProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/20 p-4", className)}>
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-cyan-400" />
        <h3 className="text-sm font-semibold text-foreground">펀딩 비율</h3>
        <span className="text-xs text-muted-foreground">8시간마다 정산 · 실시간 예상값</span>
      </div>
      <div className="flex gap-3">
        <FundingCard symbol="BTC" data={btc} />
        <FundingCard symbol="ETH" data={eth} />
        <FundingCard symbol="XRP" data={xrp} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/60">
        * 양수: 롱 포지션 과열 (롱이 숏에게 수수료 지급) · 음수: 숏 포지션 과열 · 바이낸스 공식 데이터
      </p>
    </div>
  );
}