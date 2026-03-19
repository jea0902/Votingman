import { NextResponse } from "next/server";

type TickerRow = {
  key: string;
  label: string;
  value: number | null;
  changePct: number | null;
};

type YahooMeta = {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
};

async function fetchYahooTicker(symbol: string): Promise<{ value: number | null; changePct: number | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return { value: null, changePct: null };
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta: YahooMeta | undefined = result?.meta;
    const value = typeof meta?.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
    const prev =
      typeof meta?.chartPreviousClose === "number"
        ? meta.chartPreviousClose
        : typeof meta?.previousClose === "number"
          ? meta.previousClose
          : null;
    if (value == null || prev == null || prev === 0) return { value, changePct: null };
    return { value, changePct: ((value - prev) / prev) * 100 };
  } catch {
    return { value: null, changePct: null };
  }
}

async function fetchUsdtKrwTicker(): Promise<{ value: number | null; changePct: number | null }> {
  try {
    const res = await fetch("https://api.upbit.com/v1/ticker?markets=KRW-USDT", {
      next: { revalidate: 30 },
    });
    if (!res.ok) return { value: null, changePct: null };
    const data = await res.json();
    const row = data?.[0];
    const value = typeof row?.trade_price === "number" ? row.trade_price : null;
    const changePct = typeof row?.signed_change_rate === "number" ? row.signed_change_rate * 100 : null;
    return { value, changePct };
  } catch {
    return { value: null, changePct: null };
  }
}

const YAHOO_TICKERS: Array<{ key: string; label: string; symbol: string }> = [
  { key: "btc", label: "비트코인", symbol: "BTC-USD" },
  { key: "ndq", label: "나스닥 종합", symbol: "^IXIC" },
  { key: "sp500", label: "S&P500", symbol: "^GSPC" },
  { key: "kospi", label: "코스피", symbol: "^KS11" },
  { key: "kosdaq", label: "코스닥", symbol: "^KQ11" },
  { key: "dow", label: "다우존스", symbol: "^DJI" },
  { key: "wti", label: "WTI", symbol: "CL=F" },
  { key: "vix", label: "VIX", symbol: "^VIX" },
  { key: "gold", label: "국제 금", symbol: "GC=F" },
  { key: "shanghai", label: "상해종합", symbol: "000001.SS" },
  { key: "nikkei", label: "니케이225", symbol: "^N225" },
  { key: "eurostoxx50", label: "유로스톡스 50", symbol: "^STOXX50E" },
  { key: "usdkrw", label: "환율", symbol: "KRW=X" },
];

export async function GET() {
  try {
    const yahooResults = await Promise.all(
      YAHOO_TICKERS.map(async (t) => ({
        key: t.key,
        label: t.label,
        ...(await fetchYahooTicker(t.symbol)),
      }))
    );
    const usdtKrw = await fetchUsdtKrwTicker();

    const data: TickerRow[] = [
      ...yahooResults,
      {
        key: "usdtkrw",
        label: "테더",
        value: usdtKrw.value,
        changePct: usdtKrw.changePct,
      },
    ];

    return NextResponse.json({
      success: true,
      data,
      meta: { updatedAt: Date.now() },
    });
  } catch (error) {
    console.error("[market/ticker-strip] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "TICKER_FETCH_FAILED", message: "티커 정보를 불러오지 못했습니다." },
      },
      { status: 500 }
    );
  }
}

