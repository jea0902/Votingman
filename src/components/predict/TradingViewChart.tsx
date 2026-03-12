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
  btc_1d: "BINANCE:BTCUSDT",
  btc_4h: "BINANCE:BTCUSDT",
  btc_1h: "BINANCE:BTCUSDT",
  btc_15m: "BINANCE:BTCUSDT",
  btc_5m: "BINANCE:BTCUSDT",
  ndq_1d: "TVC:NDX",
  ndq_4h: "TVC:NDX",
  sp500_1d: "TVC:SPX",
  sp500_4h: "TVC:SPX",
  kospi_1d: "KRX:KOSPI",
  kospi_4h: "KRX:KOSPI",
  kosdaq_1d: "KRX:KOSDAQ",
  kosdaq_4h: "KRX:KOSDAQ",
  dow_jones_1d: "TVC:DJI",
  dow_jones_4h: "TVC:DJI",
  wti_1d: "TVC:CL1",
  wti_4h: "TVC:CL1",
  xau_1d: "TVC:XAUUSD",
  xau_4h: "TVC:XAUUSD",
  shanghai_1d: "TVC:SHCOMP",
  shanghai_4h: "TVC:SHCOMP",
  nikkei_1d: "TVC:NI225",
  nikkei_4h: "TVC:NI225",
  eurostoxx50_1d: "TVC:STOXX50E",
  eurostoxx50_4h: "TVC:STOXX50E",
  hang_seng_1d: "TVC:HSI",
  hang_seng_4h: "TVC:HSI",
  usd_krw_1d: "OANDA:USDKRW",
  usd_krw_4h: "OANDA:USDKRW",
  jpy_krw_1d: "OANDA:JPYKRW",
  jpy_krw_4h: "OANDA:JPYKRW",
  usd10y_1d: "TVC:US10Y",
  usd10y_4h: "TVC:US10Y",
  usd30y_1d: "TVC:US30Y",
  usd30y_4h: "TVC:US30Y",
  eth_1d: "BINANCE:ETHUSDT",
  eth_4h: "BINANCE:ETHUSDT",
  eth_1h: "BINANCE:ETHUSDT",
  eth_15m: "BINANCE:ETHUSDT",
  eth_5m: "BINANCE:ETHUSDT",
  usdt_1d: "BINANCE:USDTBUSD",
  usdt_4h: "BINANCE:USDTBUSD",
  usdt_1h: "BINANCE:USDTBUSD",
  usdt_15m: "BINANCE:USDTBUSD",
  usdt_5m: "BINANCE:USDTBUSD",
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
  const symbol = TV_SYMBOL[market] ?? TV_SYMBOL.btc_1d;

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
