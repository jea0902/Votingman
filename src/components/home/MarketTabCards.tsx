"use client";

/**
 * MarketTabCards – 4.1안: 풀스크린 탭 스위처 (큰 블록 카드)
 *
 * 설계 의도:
 * - 탭을 "큰 블록/카드"로 두고, 선택한 카드가 전면에 오는 방식
 * - 모바일 스와이프·탭 전환에 유리, "월드/캐릭터 고르기" 느낌
 * - 접근성: role="tablist" / role="tab" / aria-selected / aria-controls
 */

import type { HomeTabKey } from "./VotingSection";

export const TAB_ITEMS: { key: HomeTabKey; label: string; subLabel?: string }[] = [
  { key: "btc", label: "비트코인", subLabel: "BTC 시장 심리" },
  { key: "us", label: "미국 주식", subLabel: "나스닥 · S&P500" },
  { key: "kr", label: "한국 주식", subLabel: "코스피 · 코스닥" },
];

type Props = {
  activeTab: HomeTabKey;
  onTabChange: (key: HomeTabKey) => void;
};

export function MarketTabCards({ activeTab, onTabChange }: Props) {
  return (
    <div
      className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3"
      role="tablist"
      aria-label="시장 선택"
    >
      {TAB_ITEMS.map(({ key, label, subLabel }) => {
        const isSelected = activeTab === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={`panel-${key}`}
            id={`tab-${key}`}
            onClick={() => onTabChange(key)}
            className={`
              relative flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2
              px-4 py-6 text-left transition-all duration-300 ease-out
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 focus-visible:ring-offset-background
              sm:min-h-[180px]
              ${isSelected
                ? "z-10 scale-[1.02] border-[#3b82f6] bg-[#16181c] shadow-lg shadow-[#3b82f6]/20"
                : "z-0 scale-[0.98] border-border bg-muted/40 opacity-90 hover:border-muted-foreground/40 hover:opacity-100"
              }
            `}
          >
            <span
              className={`text-lg font-bold sm:text-xl ${isSelected ? "text-[#3b82f6]" : "text-foreground"}`}
            >
              {label}
            </span>
            {subLabel && (
              <span className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {subLabel}
              </span>
            )}
            {isSelected && (
              <span
                className="absolute bottom-3 right-3 text-[10px] font-medium uppercase tracking-wider text-[#3b82f6]/80"
                aria-hidden
              >
                선택됨
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
