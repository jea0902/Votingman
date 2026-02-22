"use client";

import { cn } from "@/lib/utils";

interface TakerData {
  buySellRatio: string;
  buyVol: string;  // 코인 개수 단위
  sellVol: string;
}

interface TakerRatioProps {
  btc: TakerData | null;
  eth: TakerData | null;
  btcPrice: string | null;  // BTC 현재가 (달러 환산용)
  ethPrice: string | null;
  className?: string;
}

function formatUsdVolume(vol: string, price: string | null) {
  if (!price) return "-";
  const usd = parseFloat(vol) * parseFloat(price);
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

function TakerCard({
  symbol,
  data,
  price,
}: {
  symbol: string;
  data: TakerData | null;
  price: string | null;
}) {
  if (!data) return null;

  const ratio = parseFloat(data.buySellRatio);
  const isBullish = ratio >= 1;
  const buyPct = ((ratio / (ratio + 1)) * 100).toFixed(1);
  const sellPct = (100 - parseFloat(buyPct)).toFixed(1);

  const buyUsd = formatUsdVolume(data.buyVol, price);
  const sellUsd = formatUsdVolume(data.sellVol, price);

  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{symbol}/USDT</span>
        <span className={cn(
          "text-xs font-bold tabular-nums",
          isBullish ? "text-emerald-500" : "text-rose-500"
        )}>
          비율 {ratio.toFixed(3)}
        </span>
      </div>

      {/* 막대 */}
      <div className="relative h-6 overflow-hidden rounded-md">
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start pl-2 bg-emerald-500/70 transition-all duration-500"
          style={{ width: `${buyPct}%` }}
        >
          {parseFloat(buyPct) > 25 && (
            <span className="text-[10px] font-bold text-white">{buyPct}%</span>
          )}
        </div>
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-2 bg-rose-500/70 transition-all duration-500"
          style={{ width: `${sellPct}%` }}
        >
          {parseFloat(sellPct) > 25 && (
            <span className="text-[10px] font-bold text-white">{sellPct}%</span>
          )}
        </div>
      </div>

      {/* 실제 달러 거래량 */}
      <div className="flex justify-between rounded-lg bg-background/40 px-3 py-2 text-xs">
        <div className="space-y-0.5">
          <div className="text-muted-foreground">매수 체결</div>
          <div className="font-bold tabular-nums text-emerald-500">{buyUsd}</div>
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-muted-foreground">매도 체결</div>
          <div className="font-bold tabular-nums text-rose-500">{sellUsd}</div>
        </div>
      </div>
    </div>
  );
}

export function TakerRatio({ btc, eth, btcPrice, ethPrice, className }: TakerRatioProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/20 p-4", className)}>
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-violet-400" />
        <h3 className="text-sm font-semibold text-foreground">테이커 롱/숏 비율</h3>
        <span className="text-xs text-muted-foreground">실제 시장가 체결 방향 · 5분 기준</span>
      </div>
      <div className="flex gap-6">
        <TakerCard symbol="BTC" data={btc} price={btcPrice} />
        <div className="w-px bg-border" />
        <TakerCard symbol="ETH" data={eth} price={ethPrice} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/60">
        * 비율 1 이상: 매수세 우위 / 1 미만: 매도세 우위 · 금액은 실제 체결된 달러 거래량
      </p>
    </div>
  );
}