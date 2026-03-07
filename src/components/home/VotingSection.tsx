"use client";

/**
 * VotingSection – 투표 기능 (필터: 전체 | BTC | KOSPI | KOSDAQ | NASDAQ | S&P500)
 *
 * - GET /api/sentiment/polls 로 전체 시장 폴 일괄 조회
 * - 각 시장별 마감 시간 적용, 로그인 시 보팅코인 배팅·취소
 */

import { useState, useEffect, useCallback } from "react";
import { SENTIMENT_MARKETS } from "@/lib/constants/sentiment-markets";
import { MarketVoteCardCompact } from "./MarketVoteCardCompact";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import type { PollData } from "./MarketVoteCard";

export type PollsData = Record<string, PollData>;

/** @deprecated MarketTabCards용. 필터로 대체됨 */
export type HomeTabKey = "btc" | "us" | "kr";

/** 필터 옵션 */
export type VoteFilterKey = "all" | "btc" | "kospi" | "kosdaq" | "ndq" | "sp500";

const FILTER_OPTIONS: { key: VoteFilterKey; label: string; markets: SentimentMarket[] }[] = [
  { key: "all", label: "전체", markets: [...SENTIMENT_MARKETS] },
  { key: "btc", label: "BTC", markets: ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"] },
  { key: "kospi", label: "KOSPI", markets: ["kospi"] },
  { key: "kosdaq", label: "KOSDAQ", markets: ["kosdaq"] },
  { key: "ndq", label: "NASDAQ", markets: ["ndq"] },
  { key: "sp500", label: "S&P500", markets: ["sp500"] },
];

type Props = Record<string, never>;

export function VotingSection(_props: Props) {
  const [polls, setPolls] = useState<PollsData | null>(null);
  const [filter, setFilter] = useState<VoteFilterKey>("all");

  const fetchPolls = useCallback(async () => {
    try {
      const res = await fetch("/api/sentiment/polls", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const json = await res.json();
      if (json?.success && json?.data) {
        setPolls(json.data as PollsData);
      }
    } catch {
      setPolls(null);
    }
  }, []);

  useEffect(() => {
    fetchPolls();
    const interval = setInterval(fetchPolls, 5000);
    return () => clearInterval(interval);
  }, [fetchPolls]);

  const filterOption = FILTER_OPTIONS.find((o) => o.key === filter) ?? FILTER_OPTIONS[0];
  const marketsToShow = filterOption.markets;

  return (
    <div className="space-y-8" aria-labelledby="voting-section-heading">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <h3
          id="voting-section-heading"
          className="text-base font-semibold text-foreground"
        >
          예측 투표
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(opt.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                filter === opt.key
                  ? "bg-blue-500 text-white shadow-sm dark:bg-blue-500 dark:text-white"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:bg-muted/30 dark:hover:bg-muted/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {marketsToShow.map((market) => (
          <MarketVoteCardCompact
            key={market}
            market={market}
            poll={polls?.[market] ?? null}
          />
        ))}
      </div>

      <p className="text-center text-[10px] text-muted-foreground">
        통계적 참고용이며, 투자 권유가 아닙니다.
      </p>
    </div>
  );
}