/**
 * 인간 지표(데일리 투표) 시장 구분 및 시장별 마감 시간
 * 명세: docs/votingman-implementation-phases.md 시장별 투표 마감 시간
 *
 * btc → btc_1d 매핑: API/UI에서 "btc" 입력 시 내부적으로 "btc_1d" 사용
 */

export const SENTIMENT_MARKETS = [
  "btc_1d",
  "btc_4h",
  "btc_1h",
  "btc_15m",
  "btc_5m",
  "eth_1d",
  "eth_4h",
  "eth_1h",
  "eth_15m",
  "eth_5m",
  "usdt_1d",
  "usdt_4h",
  "usdt_1h",
  "usdt_15m",
  "usdt_5m",
  "ndq_1d",
  "ndq_4h",
  "sp500_1d",
  "sp500_4h",
  "kospi_1d",
  "kospi_4h",
  "kosdaq_1d",
  "kosdaq_4h",
  "dow_jones_1d",
  "dow_jones_4h",
  "wti_1d",
  "wti_4h",
  "xau_1d",
  "xau_4h",
  "shanghai_1d",
  "shanghai_4h",
  "nikkei_1d",
  "nikkei_4h",
  "eurostoxx50_1d",
  "eurostoxx50_4h",
  "hang_seng_1d",
  "hang_seng_4h",
  "usd_krw_1d",
  "usd_krw_4h",
  "jpy_krw_1d",
  "jpy_krw_4h",
  "usd10y_1d",
  "usd10y_4h",
  "usd30y_1d",
  "usd30y_4h",
] as const;
export type SentimentMarket = (typeof SENTIMENT_MARKETS)[number];

/** 홈에 노출하는 시장. 비트코인 1일·4시간·1시간·15분·5분봉 */
export const ACTIVE_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"] as const;

/** 모든 투표지 최소 배팅 금액 (VTC) */
export const MIN_BET_VTC = 500;

/** API/UI 입력 "btc"를 DB용 "btc_1d"로 정규화 */
export function normalizeToDbMarket(market: string): SentimentMarket {
  const normalized =
    market === "btc" ? "btc_1d" : market === "eth" ? "eth_1d" : market === "usdt" ? "usdt_1d" : market;
  return SENTIMENT_MARKETS.includes(normalized as SentimentMarket)
    ? (normalized as SentimentMarket)
    : "btc_1d";
}
export type ActiveMarket = (typeof ACTIVE_MARKETS)[number];

/** 시장별 마감 시각 (KST) — 시(0–23), 분(0–59). btc_1d만 09:00 마감, 4h/1h/15m은 롤링 마감이라 미사용 */
export const MARKET_CLOSE_KST: Record<SentimentMarket, { hour: number; minute: number }> = {
  btc_1d: { hour: 9, minute: 0 },
  btc_4h: { hour: 20, minute: 30 },
  btc_1h: { hour: 20, minute: 30 },
  btc_15m: { hour: 20, minute: 30 },
  btc_5m: { hour: 20, minute: 30 },
  eth_1d: { hour: 9, minute: 0 },
  eth_4h: { hour: 20, minute: 30 },
  eth_1h: { hour: 20, minute: 30 },
  eth_15m: { hour: 20, minute: 30 },
  eth_5m: { hour: 20, minute: 30 },
  usdt_1d: { hour: 9, minute: 0 },
  usdt_4h: { hour: 20, minute: 30 },
  usdt_1h: { hour: 20, minute: 30 },
  usdt_15m: { hour: 20, minute: 30 },
  usdt_5m: { hour: 20, minute: 30 },
  ndq_1d: { hour: 3, minute: 30 },
  ndq_4h: { hour: 20, minute: 30 },
  sp500_1d: { hour: 3, minute: 30 },
  sp500_4h: { hour: 20, minute: 30 },
  kospi_1d: { hour: 13, minute: 0 },
  kospi_4h: { hour: 20, minute: 30 },
  kosdaq_1d: { hour: 13, minute: 0 },
  kosdaq_4h: { hour: 20, minute: 30 },
  dow_jones_1d: { hour: 3, minute: 30 },
  dow_jones_4h: { hour: 20, minute: 30 },
  wti_1d: { hour: 9, minute: 0 },
  wti_4h: { hour: 20, minute: 30 },
  xau_1d: { hour: 9, minute: 0 },
  xau_4h: { hour: 20, minute: 30 },
  shanghai_1d: { hour: 16, minute: 0 },
  shanghai_4h: { hour: 20, minute: 30 },
  nikkei_1d: { hour: 15, minute: 0 },
  nikkei_4h: { hour: 20, minute: 30 },
  eurostoxx50_1d: { hour: 1, minute: 0 },
  eurostoxx50_4h: { hour: 20, minute: 30 },
  hang_seng_1d: { hour: 17, minute: 0 },
  hang_seng_4h: { hour: 20, minute: 30 },
  usd_krw_1d: { hour: 9, minute: 0 },
  usd_krw_4h: { hour: 20, minute: 30 },
  jpy_krw_1d: { hour: 9, minute: 0 },
  jpy_krw_4h: { hour: 20, minute: 30 },
  usd10y_1d: { hour: 3, minute: 30 },
  usd10y_4h: { hour: 20, minute: 30 },
  usd30y_1d: { hour: 3, minute: 30 },
  usd30y_4h: { hour: 20, minute: 30 },
};

/** 시장 표시 라벨. ndq/sp500/kospi_1d/kospi_4h/kosdaq는 사용예정 */
export const MARKET_LABEL: Record<SentimentMarket, string> = {
  btc_1d: "비트코인 1일",
  btc_4h: "비트코인 4시간",
  btc_1h: "비트코인 1시간",
  btc_15m: "비트코인 15분",
  btc_5m: "비트코인 5분",
  eth_1d: "이더리움 1일",
  eth_4h: "이더리움 4시간",
  eth_1h: "이더리움 1시간",
  eth_15m: "이더리움 15분",
  eth_5m: "이더리움 5분",
  usdt_1d: "테더 1일",
  usdt_4h: "테더 4시간",
  usdt_1h: "테더 1시간",
  usdt_15m: "테더 15분",
  usdt_5m: "테더 5분",
  ndq_1d: "1일 후 나스닥",
  ndq_4h: "4시간 후 나스닥",
  sp500_1d: "1일 후 SPX",
  sp500_4h: "4시간 후 SPX",
  kospi_1d: "1일 후 코스피",
  kospi_4h: "4시간 후 코스피",
  kosdaq_1d: "1일 후 코스닥",
  kosdaq_4h: "4시간 후 코스닥",
  dow_jones_1d: "1일 후 다우존스",
  dow_jones_4h: "4시간 후 다우존스",
  wti_1d: "1일 후 WTI",
  wti_4h: "4시간 후 WTI",
  xau_1d: "1일 후 금현물",
  xau_4h: "4시간 후 금현물",
  shanghai_1d: "1일 후 상해종합",
  shanghai_4h: "4시간 후 상해종합",
  nikkei_1d: "1일 후 니케이225",
  nikkei_4h: "4시간 후 니케이225",
  eurostoxx50_1d: "1일 후 유로스톡스50",
  eurostoxx50_4h: "4시간 후 유로스톡스50",
  hang_seng_1d: "1일 후 항셍",
  hang_seng_4h: "4시간 후 항셍",
  usd_krw_1d: "1일 후 USD/KRW",
  usd_krw_4h: "4시간 후 USD/KRW",
  jpy_krw_1d: "1일 후 JPY/KRW",
  jpy_krw_4h: "4시간 후 JPY/KRW",
  usd10y_1d: "1일 후 미국 10년물",
  usd10y_4h: "4시간 후 미국 10년물",
  usd30y_1d: "1일 후 미국 30년물",
  usd30y_4h: "4시간 후 미국 30년물",
};

/** 섹션 그룹: 비트코인 | 미국 주식 | 한국 주식 */
export const MARKET_SECTIONS: { sectionLabel: string; markets: SentimentMarket[] }[] = [
  { sectionLabel: "비트코인", markets: ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"] },
  /* 사용예정
  { sectionLabel: "미국 주식", markets: ["ndq_1d", "ndq_4h", "sp500_1d", "sp500_4h"] },
  { sectionLabel: "한국 주식", markets: ["kospi_1d", "kospi_4h", "kosdaq_1d", "kosdaq_4h"] },
  */
];

export function isSentimentMarket(value: string): value is SentimentMarket {
  const normalized =
    value === "btc" ? "btc_1d" : value === "eth" ? "eth_1d" : value === "usdt" ? "usdt_1d" : value;
  return SENTIMENT_MARKETS.includes(normalized as SentimentMarket);
}
