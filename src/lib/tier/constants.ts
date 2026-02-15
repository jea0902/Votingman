/**
 * 시장 그룹·MMR 상수 (통합 랭킹: market='all')
 */

import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import type { TierMarket } from "@/lib/supabase/db-types";

/** sentiment 시장 → 시장 그룹 (btc | us | kr) */
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

/** MMR 보정: 이전 시즌 MMR 대비 하한·상한 */
export const MMR_CLAMP_MIN = 0.7;
export const MMR_CLAMP_MAX = 1.3;
