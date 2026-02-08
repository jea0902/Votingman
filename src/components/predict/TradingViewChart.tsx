"use client";

/**
 * TradingView Advanced Chart – 예측 상세 페이지용 가격 차트
 * 시장별 심볼 매핑, 다크 테마, candlestick 스타일
 */

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";

/** 시장별 TradingView 심볼 */
const TV_SYMBOL: Record<SentimentMarket, string> = {
  btc: "BINANCE:BTCUSDT",
  ndq: "TVC:NDX",
  sp500: "TVC:SPX",
  kospi: "KRX:KOSPI",
  kosdaq: "KRX:KOSDAQ",
};

const AdvancedRealTimeChart = dynamic(
  () =>
    import("react-ts-tradingview-widgets").then((mod) => mod.AdvancedRealTimeChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-border bg-card">
        <span className="text-sm text-muted-foreground">차트 불러오는 중…</span>
      </div>
    ),
  }
);

type Props = {
  market: SentimentMarket;
  className?: string;
};

export function TradingViewChart({ market, className }: Props) {
  const symbol = TV_SYMBOL[market] ?? TV_SYMBOL.btc;

  return (
    <div
      className={cn("w-full overflow-hidden", className)}
      style={{ height: 500, minHeight: 500 }}
    >
      <AdvancedRealTimeChart
        symbol={symbol}
        interval="60"
        range="1D"
        timezone="Asia/Seoul"
        theme="dark"
        style="1"
        locale="kr"
        autosize={false}
        width="100%"
        height={500}
        allow_symbol_change={false}
        hide_legend={false}
      />
    </div>
  );
}
