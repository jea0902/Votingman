/**
 * 7단계 티어·MMR 상수
 * 명세: docs/votingman-implementation-phases.md 6단계
 */

import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import type { TierMarket } from "@/lib/supabase/db-types";

/** sentiment 시장 → 티어 시장 그룹 (btc | us | kr) */
export const SENTIMENT_TO_TIER_MARKET: Record<SentimentMarket, TierMarket> = {
  btc_1d: "btc",
  btc_4h: "btc",
  btc_1h: "btc",
  btc_15m: "btc",
  ndq: "us",
  sp500: "us",
  kospi: "kr",
  kosdaq: "kr",
};

/** 통합 랭킹: market='all'만 사용 */
export const TIER_MARKET_ALL: TierMarket = "all";
export const TIER_MARKETS: TierMarket[] = ["all"];

/** 티어 비율 (상위부터): 챌린저 1%, 마스터 9%, 다이아 10%, 플레티넘 20%, 골드 60% */
export const TIER_PERCENTILE_CUTOFFS: { tier: "challenger" | "master" | "diamond" | "platinum" | "gold"; fromTopPct: number }[] = [
  { tier: "challenger", fromTopPct: 1 },
  { tier: "master", fromTopPct: 10 },
  { tier: "diamond", fromTopPct: 20 },
  { tier: "platinum", fromTopPct: 40 },
  { tier: "gold", fromTopPct: 100 },
];

/** 배치 완료에 필요한 최소 참여 횟수 */
export const PLACEMENT_MATCHES_REQUIRED = 5;

/** 배치 보정: 이전 시즌 MMR 대비 하한·상한 */
export const MMR_CLAMP_MIN = 0.7;
export const MMR_CLAMP_MAX = 1.3;
