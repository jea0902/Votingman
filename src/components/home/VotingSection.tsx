"use client";

/**
 * VotingSection – 투표 기능 (필터: 전체 | 코인 | 한국 주식 | 미국 주식 | …)
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
  | "korea"
  | "us_stock"
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
    label: "코인",
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
  {
    key: "korea",
    label: "한국 주식",
    markets: ["kospi_1d", "kospi_1h", "kosdaq_1d", "kosdaq_1h", "samsung_1d", "samsung_1h", "skhynix_1d", "skhynix_1h", "hyundai_1d", "hyundai_1h"],
  },
  { key: "us_stock", label: "미국 주식", markets: ["ndq_1d", "ndq_4h", "sp500_1d", "sp500_4h", "dow_jones_1d", "dow_jones_4h"] },
  { key: "wti", label: "원유", markets: ["wti_1d", "wti_4h"] },
  { key: "xau", label: "광물 현물", markets: ["xau_1d", "xau_4h"] },
  { key: "shanghai", label: "중국 주식", markets: ["shanghai_1d", "shanghai_4h"] },
  { key: "nikkei", label: "일본 주식", markets: ["nikkei_1d", "nikkei_4h"] },
  { key: "eurostoxx50", label: "유럽 주식", markets: ["eurostoxx50_1d", "eurostoxx50_4h"] },
  { key: "hang_seng", label: "홍콩 주식", markets: ["hang_seng_1d", "hang_seng_4h"] },
  { key: "usd_krw", label: "환율", markets: ["usd_krw_1d", "usd_krw_4h", "jpy_krw_1d", "jpy_krw_4h"] },
  { key: "usd_bond", label: "채권", markets: ["usd10y_1d", "usd10y_4h", "usd30y_1d", "usd30y_4h"] },
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
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        // 서버 에러 디버깅: status, API 반환 error 객체(step, detail) 로그
        console.error("[VotingSection] /api/sentiment/polls HTTP error", {
          status: res.status,
          statusText: res.statusText,
          error: json?.error ?? "응답 본문 파싱 실패",
        });
        setPolls(null);
        return;
      }
      if (!json?.success) {
        console.error("[VotingSection] /api/sentiment/polls response error", json?.error);
        setPolls(null);
        return;
      }
      if (json?.data) {
        setPolls(json.data as PollsData);
      }
    } catch (error) {
      console.error("[VotingSection] fetchPolls thrown error", error);
      setPolls(null);
    }
  }, []);

  useEffect(() => {
    fetchPolls();
    // 전체 시장 폴 조회: 5초 → 10초로 완화
    const interval = setInterval(fetchPolls, 10000);
    return () => clearInterval(interval);
  }, [fetchPolls]);

  const filterOption = FILTER_OPTIONS.find((o) => o.key === filter) ?? FILTER_OPTIONS[0];
  const marketsToShow = filterOption.markets;

  /** 한국 주식 탭에서만: 지수 / 개별 주식 구역으로 나눠 표시 */
  const KOREA_INDEX_MARKETS: SentimentMarket[] = ["kospi_1d", "kospi_1h", "kosdaq_1d", "kosdaq_1h"];
  const KOREA_STOCK_MARKETS: SentimentMarket[] = ["samsung_1d", "samsung_1h", "skhynix_1d", "skhynix_1h", "hyundai_1d", "hyundai_1h"];
  const isKoreaFilter = filter === "korea";

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

      {isKoreaFilter ? (
        <div className="space-y-8">
          <section aria-labelledby="korea-index-heading">
            <h4 id="korea-index-heading" className="mb-3 text-sm font-medium text-muted-foreground">
              지수
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {KOREA_INDEX_MARKETS.map((market) => (
                <MarketVoteCardCompact
                  key={market}
                  market={market}
                  poll={polls?.[market] ?? null}
                />
              ))}
            </div>
          </section>
          <section aria-labelledby="korea-stock-heading">
            <h4 id="korea-stock-heading" className="mb-3 text-sm font-medium text-muted-foreground">
              개별 주식
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {KOREA_STOCK_MARKETS.map((market) => (
                <MarketVoteCardCompact
                  key={market}
                  market={market}
                  poll={polls?.[market] ?? null}
                />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {marketsToShow.map((market) => (
            <MarketVoteCardCompact
              key={market}
              market={market}
              poll={polls?.[market] ?? null}
            />
          ))}
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        통계적 참고용이며, 투자 권유가 아닙니다.
      </p>
    </div>
  );
}