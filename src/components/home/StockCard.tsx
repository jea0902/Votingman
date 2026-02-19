"use client";

/**
 * StockCard - 우량주/저평가 종목 카드
 *
 * 설계 의도:
 * - 빨간색 카드: 우량주
 * - 황금색 카드: 우량주 + 저평가
 * - 컴팩트하고 직관적인 정보 표시
 * - 호버 시 살짝 확대 효과
 */

import { cn } from "@/lib/utils";

interface Stock {
  id: string;
  name: string;
  ticker: string;
  logo: string;
  qualityCriteria: string[];
  undervalued: boolean;
  undervaluedReason?: string;
  fairValue: string;
}

interface StockCardProps {
  stock: Stock;
}

export function StockCard({ stock }: StockCardProps) {
  const isUndervalued = stock.undervalued;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border-2 p-4 transition-all duration-300 hover:scale-105 hover:shadow-2xl",
        isUndervalued
          ? "border-amber-500/50 bg-gradient-to-br from-amber-900/20 to-yellow-900/10 shadow-amber-500/20"
          : "border-red-500/50 bg-gradient-to-br from-red-900/20 to-rose-900/10 shadow-red-500/20"
      )}
    >
      {/* 배지: 우량주 vs 저평가 우량주 */}
      <div
        className={cn(
          "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
          isUndervalued
            ? "bg-amber-500 text-black"
            : "bg-red-500 text-white"
        )}
      >
        {isUndervalued ? "🔥 저평가" : "✓ 우량주"}
      </div>

      {/* 로고 + 회사명 + 티커 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-3xl">{stock.logo}</span>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-foreground">{stock.name}</h3>
          <p className="text-xs text-muted-foreground">{stock.ticker}</p>
        </div>
      </div>

      {/* 구분선 */}
      <div
        className={cn(
          "mb-3 h-px",
          isUndervalued ? "bg-amber-500/30" : "bg-red-500/30"
        )}
      />

      {/* 우량주 기준 */}
      <div className="mb-2">
        <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
          우량주 기준
        </p>
        <div className="flex flex-wrap gap-1">
          {stock.qualityCriteria.map((criterion, idx) => (
            <span
              key={idx}
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-medium",
                isUndervalued
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  : "bg-red-500/20 text-red-300"
              )}
            >
              {criterion}
            </span>
          ))}
        </div>
      </div>

      {/* 저평가 이유 (저평가 종목만) */}
      {isUndervalued && stock.undervaluedReason && (
        <div className="mb-2">
          <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
            저평가 이유
          </p>
          <p className="text-[10px] font-medium text-amber-800 dark:text-amber-200">
            {stock.undervaluedReason}
          </p>
        </div>
      )}

      {/* 적정가 */}
      <div className="mt-3 rounded-md bg-background/40 px-2 py-1.5 text-center backdrop-blur-sm">
        <p className="text-[9px] font-semibold text-muted-foreground">
          적정가
        </p>
        <p
          className={cn(
            "text-lg font-bold",
            isUndervalued ? "text-amber-700 dark:text-amber-400" : "text-red-400"
          )}
        >
          {stock.fairValue}
        </p>
      </div>
    </div>
  );
}
