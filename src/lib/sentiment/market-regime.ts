/**
 * 시장세 5단계 분류 및 과거 같은 장세일 때 롱/숏 당첨률 집계
 * 명세: docs/votingman-implementation-phases.md 5단계
 *
 * 설계 의도:
 * - N일 수익률 = (당일 종가 − N일 전 종가) / N일 전 종가 × 100
 * - 5구간: 폭등 >12%, 상승 3~12%, 횡보 -3~3%, 하락 -12~-3%, 폭락 <-12%
 * - 같은 장세일 때: 일봉 상승(롱 당첨) / 하락(숏 당첨) 비율 집계
 */

const BINANCE_KLINES = "https://api.binance.com/api/v3/klines";
const SYMBOL_BTC = "BTCUSDT";
const N_DAYS = 20;
const LIMIT_DAYS = 400;

/** 시장세 5구간 라벨 */
export type RegimeLabel =
  | "폭등장"
  | "상승장"
  | "횡보장"
  | "하락장"
  | "폭락장";

/** 시장세 임계값 (비트코인: 변동성 큼) - 문서 명세 */
const REGIME_THRESHOLDS: { label: RegimeLabel; min: number; max: number }[] = [
  { label: "폭락장", min: -Infinity, max: -12 },
  { label: "하락장", min: -12, max: -3 },
  { label: "횡보장", min: -3, max: 3 },
  { label: "상승장", min: 3, max: 12 },
  { label: "폭등장", min: 12, max: Infinity },
];

function classifyRegime(nDayReturnPct: number): RegimeLabel {
  for (const t of REGIME_THRESHOLDS) {
    if (nDayReturnPct >= t.min && nDayReturnPct < t.max) return t.label;
  }
  return "횡보장";
}

type DailyCandle = {
  date: string; // YYYY-MM-DD KST
  open: number;
  close: number;
  nDayReturnPct: number | null;
  regime: RegimeLabel | null;
};

/** Binance 1d 봉 조회 (open, high, low, close) */
async function fetchBtcDailyKlines(): Promise<DailyCandle[]> {
  const url = new URL(BINANCE_KLINES);
  url.searchParams.set("symbol", SYMBOL_BTC);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("limit", String(LIMIT_DAYS));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const data = (await res.json()) as unknown[];
  if (!Array.isArray(data)) throw new Error("Invalid Binance response");

  const candles: DailyCandle[] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i] as unknown[];
    const openTime = Number(row[0]);
    const open = Number(row[1]);
    const close = Number(row[4]);

    // openTime은 UTC 00:00 - KST 09:00이 해당일 시작
    const d = new Date(openTime + 9 * 60 * 60 * 1000);
    const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

    let nDayReturnPct: number | null = null;
    let regime: RegimeLabel | null = null;
    if (i >= N_DAYS) {
      const closeN = Number((data[i - N_DAYS] as unknown[])[4]);
      nDayReturnPct = ((close - closeN) / closeN) * 100;
      regime = classifyRegime(nDayReturnPct);
    }

    candles.push({
      date,
      open,
      close,
      nDayReturnPct,
      regime,
    });
  }
  return candles;
}

export type MarketRegimeResult = {
  market: string;
  currentRegime: RegimeLabel | null;
  nDayReturnPct: number | null;
  /** 과거 같은 장세일 때: 롱 당첨률(일봉 상승 비율), 숏 당첨률(일봉 하락 비율) */
  pastStats: {
    regime: RegimeLabel;
    longWinRatePct: number;
    shortWinRatePct: number;
    sampleCount: number;
  }[];
};

/**
 * btc 시장의 현재 시장세 및 과거 같은 장세일 때 롱/숏 당첨률 계산
 */
export async function computeMarketRegime(market: string): Promise<MarketRegimeResult> {
  if (market !== "btc_1d") {
    return {
      market,
      currentRegime: null,
      nDayReturnPct: null,
      pastStats: [],
    };
  }

  const candles = await fetchBtcDailyKlines();
  const latest = candles[candles.length - 1];

  const regimeToDays = new Map<
    RegimeLabel,
    { longWins: number; shortWins: number; total: number }
  >();
  for (const t of REGIME_THRESHOLDS) {
    regimeToDays.set(t.label, { longWins: 0, shortWins: 0, total: 0 });
  }

  for (const c of candles) {
    if (c.regime == null) continue;
    const entry = regimeToDays.get(c.regime)!;
    entry.total++;
    if (c.close > c.open) entry.longWins++;
    else if (c.close < c.open) entry.shortWins++;
  }

  const pastStats = REGIME_THRESHOLDS.map(({ label }) => {
    const e = regimeToDays.get(label)!;
    const longWinRatePct =
      e.total > 0 ? Math.round((e.longWins / e.total) * 1000) / 10 : 50;
    const shortWinRatePct =
      e.total > 0 ? Math.round((e.shortWins / e.total) * 1000) / 10 : 50;
    return {
      regime: label,
      longWinRatePct,
      shortWinRatePct,
      sampleCount: e.total,
    };
  });

  return {
    market: "btc_1d",
    currentRegime: latest?.regime ?? null,
    nDayReturnPct: latest?.nDayReturnPct ?? null,
    pastStats,
  };
}
