"use client";

/**
 * HumanIndicatorSection – 투표 기능 (3개 섹션: 비트코인 | 미국 주식 | 한국 주식)
 *
 * - GET /api/sentiment/polls 로 5개 시장 폴 일괄 조회
 * - 각 시장별 마감 시간 적용, 로그인 시 보팅코인 배팅·취소
 */

import { useState, useEffect, useCallback } from "react";
import { ACTIVE_MARKETS, MARKET_SECTIONS } from "@/lib/constants/sentiment-markets";
import { MarketVoteCardCompact } from "./MarketVoteCardCompact";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import type { PollData } from "./MarketVoteCard";

export type PollsData = Record<string, PollData>;

/** 홈 탭과 매칭: 비트코인 | 미국 주식 | 한국 주식 */
export type HomeTabKey = "btc" | "us" | "kr";

const TAB_TO_SECTION_INDEX: Record<HomeTabKey, number> = {
  btc: 0,
  us: 1,
  kr: 2,
};

type Props = {
  /** 지정 시 해당 탭의 시장만 렌더 (홈 3탭용). 미지정 시 전체 노출 */
  activeTab?: HomeTabKey;
};

export function HumanIndicatorSection({ activeTab }: Props = {}) {
  const [polls, setPolls] = useState<PollsData | null>(null);

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

  const section = activeTab != null ? MARKET_SECTIONS[TAB_TO_SECTION_INDEX[activeTab]] : null;
  const marketsToShow = section?.markets ?? ([...ACTIVE_MARKETS] as SentimentMarket[]);
  const heading = section?.sectionLabel ?? "예측 투표";

  return (
    <div className="space-y-8" aria-labelledby="human-indicator-heading">
      <h3 className="mb-3 text-base font-semibold text-foreground">
        {heading}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
