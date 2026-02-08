"use client";

/**
 * Market Context – 시장세 추천 (btc만 지원)
 * Rules 박스와 동일한 스타일로 표시
 */

import { useState, useEffect } from "react";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";

type RegimeData = {
  currentRegime: string | null;
  pastStats: {
    regime: string;
    longWinRatePct: number;
    shortWinRatePct: number;
    sampleCount: number;
  }[];
};

type Props = {
  market: SentimentMarket;
};

export function MarketContextContent({ market }: Props) {
  const [data, setData] = useState<RegimeData | null>(null);

  useEffect(() => {
    if (market !== "btc") return;
    let cancelled = false;
    fetch(`/api/sentiment/market-regime?market=btc`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && json?.data) {
          const d = json.data;
          setData({
            currentRegime: d.currentRegime ?? null,
            pastStats: Array.isArray(d.pastStats) ? d.pastStats : [],
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [market]);

  if (market !== "btc") {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="mb-2 text-sm font-semibold text-foreground">
          시장 컨텍스트
        </h4>
        <p className="text-xs leading-relaxed text-muted-foreground">
          현재 시장세 분석은 비트코인 시장에서만 제공됩니다.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="mb-2 text-sm font-semibold text-foreground">
          시장세 분석
        </h4>
        <p className="text-xs text-muted-foreground">불러오는 중…</p>
      </div>
    );
  }

  const stat =
    data.currentRegime && data.pastStats.length > 0
      ? data.pastStats.find((s) => s.regime === data.currentRegime)
      : null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h4 className="mb-2 text-sm font-semibold text-foreground">
        시장세 분석
      </h4>
      {data.currentRegime ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">
            현재 시장세:{" "}
            <span className="text-primary">{data.currentRegime}</span>
          </p>
          {stat && stat.sampleCount >= 5 && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              과거 {data.currentRegime}일 때: 롱 당첨 {stat.longWinRatePct}% /
              숏 당첨 {stat.shortWinRatePct}%
              <span className="ml-1 opacity-80">
                ({stat.sampleCount}일 샘플)
              </span>
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          시장세 데이터가 아직 수집되지 않았습니다.
        </p>
      )}
    </div>
  );
}
