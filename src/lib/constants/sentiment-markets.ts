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
  "ndq",
  "sp500",
  "kospi",
  "kosdaq",
] as const;
export type SentimentMarket = (typeof SENTIMENT_MARKETS)[number];

/** 홈에 노출하는 시장. 비트코인 1일·4시간·1시간·15분봉 */
export const ACTIVE_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;

/** API/UI 입력 "btc"를 DB용 "btc_1d"로 정규화 */
export function normalizeToDbMarket(market: string): SentimentMarket {
  const normalized = market === "btc" ? "btc_1d" : market;
  return SENTIMENT_MARKETS.includes(normalized as SentimentMarket)
    ? (normalized as SentimentMarket)
    : "btc_1d";
}
export type ActiveMarket = (typeof ACTIVE_MARKETS)[number];

/** 시장별 마감 시각 (KST) — 시(0–23), 분(0–59). 4h/1h/15m은 롤링 마감(현재 봉 시작+주기 절반)이라 이 값은 미사용 */
export const MARKET_CLOSE_KST: Record<SentimentMarket, { hour: number; minute: number }> = {
  btc_1d: { hour: 20, minute: 30 },
  btc_4h: { hour: 20, minute: 30 },
  btc_1h: { hour: 20, minute: 30 },
  btc_15m: { hour: 20, minute: 30 },
  ndq: { hour: 3, minute: 30 },
  sp500: { hour: 3, minute: 30 },
  kospi: { hour: 13, minute: 0 },
  kosdaq: { hour: 13, minute: 0 },
};

/** 시장 표시 라벨. ndq/sp500/kospi/kosdaq는 사용예정 */
export const MARKET_LABEL: Record<SentimentMarket, string> = {
  btc_1d: "비트코인 1일",
  btc_4h: "비트코인 4시간",
  btc_1h: "비트코인 1시간",
  btc_15m: "비트코인 15분",
  ndq: "나스닥",
  sp500: "S&P 500",
  kospi: "코스피",
  kosdaq: "코스닥",
};

/** 섹션 그룹: 비트코인 | 미국 주식 | 한국 주식 */
export const MARKET_SECTIONS: { sectionLabel: string; markets: SentimentMarket[] }[] = [
  { sectionLabel: "비트코인", markets: ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] },
  /* 사용예정
  { sectionLabel: "미국 주식", markets: ["ndq", "sp500"] },
  { sectionLabel: "한국 주식", markets: ["kospi", "kosdaq"] },
  */
];

export function isSentimentMarket(value: string): value is SentimentMarket {
  const normalized = value === "btc" ? "btc_1d" : value;
  return SENTIMENT_MARKETS.includes(normalized as SentimentMarket);
}
