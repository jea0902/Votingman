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
  btc_5m: "btc",
  eth_1d: "btc",
  eth_4h: "btc",
  eth_1h: "btc",
  eth_15m: "btc",
  eth_5m: "btc",
  usdt_1d: "btc",
  usdt_4h: "btc",
  usdt_1h: "btc",
  usdt_15m: "btc",
  usdt_5m: "btc",
  xrp_1d: "btc",
  xrp_4h: "btc",
  xrp_1h: "btc",
  xrp_15m: "btc",
  xrp_5m: "btc",
  ndq_1d: "us",
  ndq_4h: "us",
  sp500_1d: "us",
  sp500_4h: "us",
  kospi_1d: "kr",
  kospi_4h: "kr",
  kosdaq_1d: "kr",
  kosdaq_4h: "kr",
  dow_jones_1d: "us",
  dow_jones_4h: "us",
  wti_1d: "us",
  wti_4h: "us",
  xau_1d: "us",
  xau_4h: "us",
  shanghai_1d: "kr",
  shanghai_4h: "kr",
  nikkei_1d: "kr",
  nikkei_4h: "kr",
  eurostoxx50_1d: "us",
  eurostoxx50_4h: "us",
  hang_seng_1d: "kr",
  hang_seng_4h: "kr",
  usd_krw_1d: "kr",
  usd_krw_4h: "kr",
  jpy_krw_1d: "kr",
  jpy_krw_4h: "kr",
  usd10y_1d: "us",
  usd10y_4h: "us",
  usd30y_1d: "us",
  usd30y_4h: "us",
};

/** 통합 랭킹: market='all'만 사용 */
export const TIER_MARKET_ALL: TierMarket = "all";
export const TIER_MARKETS: TierMarket[] = ["all"];

/** MMR 보정 (레거시, 미사용) */
export const MMR_CLAMP_MIN = 0.7;
export const MMR_CLAMP_MAX = 1.3;
