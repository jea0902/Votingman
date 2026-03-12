"use client";

/**
 * 시장별 아이콘 (BTC, NDQ, SPX, KOSPI, KOSDAQ)
 * - 홈 투표 카드, 투표 상세 페이지에서 공통 사용
 */

import Image from "next/image";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";

const COIN_MARKETS = [
  "btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m",
  "eth_1d", "eth_4h", "eth_1h", "eth_15m", "eth_5m",
  "usdt_1d", "usdt_4h", "usdt_1h", "usdt_15m", "usdt_5m",
] as const;
function isCoinMarket(m: string): m is (typeof COIN_MARKETS)[number] {
  return COIN_MARKETS.includes(m as (typeof COIN_MARKETS)[number]);
}

const COIN_ICON: Record<string, string> = {
  btc_1d: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  btc_4h: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  btc_1h: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  btc_15m: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  btc_5m: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  eth_1d: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  eth_4h: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  eth_1h: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  eth_15m: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  eth_5m: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  usdt_1d: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  usdt_4h: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  usdt_1h: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  usdt_15m: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  usdt_5m: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
};

const TIMEFRAME_LABEL: Record<string, string> = {
  btc_1d: "1D", btc_4h: "4H", btc_1h: "1H", btc_15m: "15m", btc_5m: "5m",
  eth_1d: "1D", eth_4h: "4H", eth_1h: "1H", eth_15m: "15m", eth_5m: "5m",
  usdt_1d: "1D", usdt_4h: "4H", usdt_1h: "1H", usdt_15m: "15m", usdt_5m: "5m",
};

const STOCK_ICON_URL: Record<string, string> = {
  ndq_1d: "https://s3-symbol-logo.tradingview.com/indices/nasdaq-100--big.svg",
  ndq_4h: "https://s3-symbol-logo.tradingview.com/indices/nasdaq-100--big.svg",
  sp500_1d: "https://s3-symbol-logo.tradingview.com/indices/s-and-p-500--big.svg",
  sp500_4h: "https://s3-symbol-logo.tradingview.com/indices/s-and-p-500--big.svg",
  kospi_1d: "https://s3-symbol-logo.tradingview.com/indices/korea-composite-index--big.svg",
  kospi_4h: "https://s3-symbol-logo.tradingview.com/indices/korea-composite-index--big.svg",
  kosdaq_1d: "https://s3-symbol-logo.tradingview.com/indices/kosdaq--big.svg",
  kosdaq_4h: "https://s3-symbol-logo.tradingview.com/indices/kosdaq--big.svg",
  dow_jones_1d: "https://s3-symbol-logo.tradingview.com/indices/dow-30--big.svg",
  dow_jones_4h: "https://s3-symbol-logo.tradingview.com/indices/dow-30--big.svg",
  wti_1d: "https://s3-symbol-logo.tradingview.com/commodities/light-crude-oil--big.svg",
  wti_4h: "https://s3-symbol-logo.tradingview.com/commodities/light-crude-oil--big.svg",
  xau_1d: "https://s3-symbol-logo.tradingview.com/commodities/gold--big.svg",
  xau_4h: "https://s3-symbol-logo.tradingview.com/commodities/gold--big.svg",
  shanghai_1d: "https://s3-symbol-logo.tradingview.com/indices/shanghai-composite--big.svg",
  shanghai_4h: "https://s3-symbol-logo.tradingview.com/indices/shanghai-composite--big.svg",
  nikkei_1d: "https://s3-symbol-logo.tradingview.com/indices/japan-ni225--big.svg",
  nikkei_4h: "https://s3-symbol-logo.tradingview.com/indices/japan-ni225--big.svg",
  eurostoxx50_1d: "https://s3-symbol-logo.tradingview.com/indices/euro-stoxx-50--big.svg",
  eurostoxx50_4h: "https://s3-symbol-logo.tradingview.com/indices/euro-stoxx-50--big.svg",
  hang_seng_1d: "https://s3-symbol-logo.tradingview.com/indices/hang-seng-index--big.svg",
  hang_seng_4h: "https://s3-symbol-logo.tradingview.com/indices/hang-seng-index--big.svg",
  usd_krw_1d: "https://s3-symbol-logo.tradingview.com/forex/usdkrw--big.svg",
  usd_krw_4h: "https://s3-symbol-logo.tradingview.com/forex/usdkrw--big.svg",
  jpy_krw_1d: "https://s3-symbol-logo.tradingview.com/forex/jpykrw--big.svg",
  jpy_krw_4h: "https://s3-symbol-logo.tradingview.com/forex/jpykrw--big.svg",
  usd10y_1d: "https://s3-symbol-logo.tradingview.com/bonds/us-10y--big.svg",
  usd10y_4h: "https://s3-symbol-logo.tradingview.com/bonds/us-10y--big.svg",
  usd30y_1d: "https://s3-symbol-logo.tradingview.com/bonds/us-30y--big.svg",
  usd30y_4h: "https://s3-symbol-logo.tradingview.com/bonds/us-30y--big.svg",
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

  if (isCoinMarket(market)) {
    const iconUrl = COIN_ICON[market];
    return (
      <div
        className={`flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/20 ${size === "compact" ? "h-9 px-2" : "h-10 px-2.5 gap-2"}`}
      >
        <Image
          src={iconUrl ?? "https://assets.coingecko.com/coins/images/1/small/bitcoin.png"}
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
