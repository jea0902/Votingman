"use client";

/**
 * StrategyCard - 매매법 카드
 *
 * 설계 의도:
 * - 버핏원픽 StockCard와 동일한 디자인 스타일
 * - 매매법 성과 지표 표시 (백테스팅 기간, 수익률, 승률, 손익비)
 * - 호버 시 살짝 확대 효과
 * - 다양한 색상 테마로 구분
 */

import { cn } from "@/lib/utils";

interface Strategy {
  id: string;
  name: string;
  backtestingPeriod: string;
  monthlyReturn: string;
  annualReturn: string;
  winRate: string;
  profitLossRatio: string;
  colorTheme: "blue" | "amber" | "green";
}

interface StrategyCardProps {
  strategy: Strategy;
}

const colorThemes = {
  blue: {
    border: "border-blue-500/50",
    bg: "bg-gradient-to-br from-blue-900/20 to-cyan-900/10",
    shadow: "shadow-blue-500/20",
    divider: "bg-blue-500/30",
    badge: "bg-blue-500 text-white",
    label: "bg-blue-500/20 text-blue-300",
    value: "text-blue-400",
  },
  amber: {
    border: "border-amber-500/50",
    bg: "bg-gradient-to-br from-amber-900/20 to-yellow-900/10",
    shadow: "shadow-amber-500/20",
    divider: "bg-amber-500/30",
    badge: "bg-amber-500 text-black",
    label: "bg-amber-500/20 text-amber-300",
    value: "text-amber-400",
  },
  green: {
    border: "border-green-500/50",
    bg: "bg-gradient-to-br from-green-900/20 to-emerald-900/10",
    shadow: "shadow-green-500/20",
    divider: "bg-green-500/30",
    badge: "bg-green-500 text-white",
    label: "bg-green-500/20 text-green-300",
    value: "text-green-400",
  },
};

export function StrategyCard({ strategy }: StrategyCardProps) {
  const theme = colorThemes[strategy.colorTheme];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border-2 p-4 transition-all duration-300 hover:scale-105 hover:shadow-2xl",
        theme.border,
        theme.bg,
        theme.shadow
      )}
    >
      {/* 배지: 매매법 번호 */}
      <div
        className={cn(
          "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
          theme.badge
        )}
      >
        {strategy.name}
      </div>

      {/* 매매법 이름 */}
      <div className="mb-3">
        <h3 className="text-lg font-bold text-foreground">{strategy.name}</h3>
      </div>

      {/* 구분선 */}
      <div className={cn("mb-3 h-px", theme.divider)} />

      {/* 백테스팅 기간 */}
      <div className="mb-2">
        <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
          백테스팅 기간
        </p>
        <p className="text-xs font-medium text-foreground">
          {strategy.backtestingPeriod}
        </p>
      </div>

      {/* 수익률 정보 */}
      <div className="mb-2">
        <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
          수익률
        </p>
        <div className="flex flex-wrap gap-1">
          <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium", theme.label)}>
            월평균 {strategy.monthlyReturn}
          </span>
          <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium", theme.label)}>
            연평균 {strategy.annualReturn}
          </span>
        </div>
      </div>

      {/* 승률 */}
      <div className="mb-2">
        <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
          승률
        </p>
        <p className="text-xs font-medium text-foreground">
          {strategy.winRate}
        </p>
      </div>

      {/* 손익비 */}
      <div className="mt-3 rounded-md bg-background/40 px-2 py-1.5 text-center backdrop-blur-sm">
        <p className="text-[9px] font-semibold text-muted-foreground">
          손익비
        </p>
        <p className={cn("text-lg font-bold", theme.value)}>
          {strategy.profitLossRatio}
        </p>
      </div>
    </div>
  );
}
