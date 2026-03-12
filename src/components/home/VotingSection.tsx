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
export type VoteFilterKey =
  | "all"
  | "btc"
  | "kospi"
  | "kosdaq"
  | "ndq"
  | "sp500"
  | "dow_jones"
  | "wti"
  | "xau"
  | "shanghai"
  | "nikkei"
  | "eurostoxx50"
  | "hang_seng"
  | "usd_krw"
  | "usd_bond";

/** USDT 제외: 투표 박스 숨김 (수집·정산 테스트 후 제거 예정) */
const HIDDEN_USDT_MARKETS = new Set<string>([
  "usdt_1d", "usdt_4h", "usdt_1h", "usdt_15m", "usdt_5m",
]);
const DISPLAY_MARKETS = SENTIMENT_MARKETS.filter((m) => !HIDDEN_USDT_MARKETS.has(m));

const FILTER_OPTIONS: { key: VoteFilterKey; label: string; markets: SentimentMarket[] }[] = [
  { key: "all", label: "전체", markets: [...DISPLAY_MARKETS] },
  {
    key: "btc",
    label: "COIN",
    markets: [
      "btc_1d",
      "btc_4h",
      "btc_1h",
      "btc_15m",
      "btc_5m",
      "eth_1d",
      "eth_4h",
      "eth_1h",
      "eth_15m",
      "eth_5m",
      "xrp_1d",
      "xrp_4h",
      "xrp_1h",
      "xrp_15m",
      "xrp_5m",
    ],
  },
  { key: "kospi", label: "KOSPI", markets: ["kospi_1d", "kospi_4h"] },
  { key: "kosdaq", label: "KOSDAQ", markets: ["kosdaq_1d", "kosdaq_4h"] },
  { key: "ndq", label: "NASDAQ", markets: ["ndq_1d", "ndq_4h"] },
  { key: "sp500", label: "S&P500", markets: ["sp500_1d", "sp500_4h"] },
  { key: "dow_jones", label: "다우존스", markets: ["dow_jones_1d", "dow_jones_4h"] },
  { key: "wti", label: "WTI", markets: ["wti_1d", "wti_4h"] },
  { key: "xau", label: "금현물", markets: ["xau_1d", "xau_4h"] },
  { key: "shanghai", label: "상해종합", markets: ["shanghai_1d", "shanghai_4h"] },
  { key: "nikkei", label: "니케이225", markets: ["nikkei_1d", "nikkei_4h"] },
  { key: "eurostoxx50", label: "유로스톡스50", markets: ["eurostoxx50_1d", "eurostoxx50_4h"] },
  { key: "hang_seng", label: "항셍", markets: ["hang_seng_1d", "hang_seng_4h"] },
  { key: "usd_krw", label: "환율", markets: ["usd_krw_1d", "usd_krw_4h", "jpy_krw_1d", "jpy_krw_4h"] },
  { key: "usd_bond", label: "미국채권", markets: ["usd10y_1d", "usd10y_4h", "usd30y_1d", "usd30y_4h"] },
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