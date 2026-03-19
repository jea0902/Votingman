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
export type HomeCoinKey = "btc" | "eth" | "xrp";

/** @deprecated MarketTabCards용. 필터로 대체됨 */
export type HomeTabKey = "btc" | "us" | "kr";

/** USDT 제외: 투표 박스 숨김 (수집·정산 테스트 후 제거 예정) */
const HIDDEN_USDT_MARKETS = new Set<string>([
  "usdt_1d", "usdt_4h", "usdt_1h", "usdt_15m", "usdt_5m",
]);
const DISPLAY_MARKETS = SENTIMENT_MARKETS.filter((m) => !HIDDEN_USDT_MARKETS.has(m));


type Props = {
  selectedCoin?: HomeCoinKey;
};

export function VotingSection({ selectedCoin }: Props) {
  const [polls, setPolls] = useState<PollsData | null>(null);

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

  const coinOnlyMarkets: SentimentMarket[] = selectedCoin
    ? (DISPLAY_MARKETS.filter((market) => market.startsWith(`${selectedCoin}_`)) as SentimentMarket[])
    : [...DISPLAY_MARKETS];
  const marketsToShow = coinOnlyMarkets;

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto pb-2">
        <div className="flex snap-x snap-mandatory gap-3">
        {marketsToShow.map((market) => (
          <div key={market} className="w-[72vw] min-w-[220px] max-w-[260px] snap-start sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px] md:w-[250px] md:min-w-[250px] md:max-w-[250px]">
            <MarketVoteCardCompact
              market={market}
              poll={polls?.[market] ?? null}
            />
          </div>
        ))}
        </div>
      </div>

    </div>
  );
}