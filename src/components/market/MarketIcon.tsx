"use client";

/**
 * 시장별 아이콘 (BTC, NDQ, SPX, KOSPI, KOSDAQ)
 * - 홈 투표 카드, 투표 상세 페이지에서 공통 사용
 */

import Image from "next/image";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";

const BTC_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"] as const;
function isBtcMarket(m: string): m is (typeof BTC_MARKETS)[number] {
  return BTC_MARKETS.includes(m as (typeof BTC_MARKETS)[number]);
}

const TIMEFRAME_LABEL: Record<string, string> = {
  btc_1d: "1D",
  btc_4h: "4H",
  btc_1h: "1H",
  btc_15m: "15m",
  btc_5m: "5m",
};

const STOCK_ICON_URL: Record<string, string> = {
  ndq: "https://s3-symbol-logo.tradingview.com/indices/nasdaq-100--big.svg",
  sp500: "https://s3-symbol-logo.tradingview.com/indices/s-and-p-500--big.svg",
  kospi: "https://s3-symbol-logo.tradingview.com/indices/korea-composite-index--big.svg",
  kosdaq: "https://s3-symbol-logo.tradingview.com/indices/kosdaq--big.svg",
};

type Props = {
  market: SentimentMarket;
  /** compact: 36px (홈 카드), default: 40px (상세 페이지) */
  size?: "compact" | "default";
  /** btc 시장만: 시간봉 라벨 표시 (1D, 4H 등) */
  showTimeframe?: boolean;
};

export function MarketIcon({ market, size = "default", showTimeframe = false }: Props) {
  const px = size === "compact" ? 36 : 40;

  if (isBtcMarket(market)) {
    return (
      <div
        className={`flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/20 ${size === "compact" ? "h-9 px-2" : "h-10 px-2.5 gap-2"}`}
      >
        <Image
          src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
          alt=""
          width={size === "compact" ? 24 : 28}
          height={size === "compact" ? 24 : 28}
          className="shrink-0"
        />
        {showTimeframe && (
          <span
            className={`font-bold text-amber-700 dark:text-amber-500 ${size === "compact" ? "text-xs" : "text-sm"}`}
          >
            {TIMEFRAME_LABEL[market] ?? market}
          </span>
        )}
      </div>
    );
  }

  const imageUrl = STOCK_ICON_URL[market];
  if (imageUrl) {
    return (
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-muted/30"
        style={{ width: px, height: px }}
      >
        <Image
          src={imageUrl}
          alt=""
          width={px}
          height={px}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-sm font-bold text-amber-700 dark:text-amber-500"
      style={{ width: px, height: px }}
    >
      {market.toUpperCase()}
    </span>
  );
}
