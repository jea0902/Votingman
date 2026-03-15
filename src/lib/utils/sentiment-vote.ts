/**
 * 인간 지표(데일리 투표) 관련 유틸
 *
 * 설계 의도:
 * - 1일봉(btc_1d): 당일 KST 12:00 고정 마감 (봉 절반 = 12시간)
 * - 4h/1h/15m: 현재 봉 시작 시각 + 주기 절반에 마감 (롤링)
 * - 미국/한국 주식: 시장별 고정 시각 (KST)
 */

import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import {
  MARKET_CLOSE_KST,
  isSentimentMarket,
} from "@/lib/constants/sentiment-markets";
import {
  getCurrentCandleStartAt,
  CANDLE_PERIOD_MS,
  VOTING_CLOSE_EARLY_MS,
} from "@/lib/btc-ohlc/candle-utils";
import { isTradingDayKST } from "@/lib/korea-ohlc/market-hours";

/** 4h/1h/15m/5m: 주기 절반(기존 마감 시각, 현재 사용하지 않음) — 밀리초 */
const ROLLING_HALF_PERIOD_MS: Record<"btc_4h" | "btc_1h" | "btc_15m" | "btc_5m", number> = {
  btc_4h: 2 * 60 * 60 * 1000,
  btc_1h: 30 * 60 * 1000,
  btc_15m: 7.5 * 60 * 1000,
  btc_5m: 2.5 * 60 * 1000,
};

const ROLLING_4H_MS = 4 * 60 * 60 * 1000;

const ROLLING_MARKETS: SentimentMarket[] = [
  "btc_4h",
  "btc_1h",
  "btc_15m",
  "btc_5m",
  "eth_4h",
  "eth_1h",
  "eth_15m",
  "eth_5m",
  "usdt_4h",
  "usdt_1h",
  "usdt_15m",
  "usdt_5m",
  "xrp_4h",
  "xrp_1h",
  "xrp_15m",
  "xrp_5m",
  "ndq_4h",
  "sp500_4h",
  "kospi_4h",
  "kosdaq_4h",
  "dow_jones_4h",
  "wti_4h",
  "xau_4h",
  "shanghai_4h",
  "nikkei_4h",
  "eurostoxx50_4h",
  "hang_seng_4h",
  "usd_krw_4h",
  "jpy_krw_4h",
  "usd10y_4h",
  "usd30y_4h",
];

function isRollingMarket(m: SentimentMarket): boolean {
  return ROLLING_MARKETS.includes(m);
}

/** 롤링 시장: 주기 전체(다음 봉 시작까지) — 밀리초 */
function getRollingPeriodMs(m: SentimentMarket): number {
  if (m === "btc_1h" || m === "eth_1h" || m === "usdt_1h" || m === "xrp_1h") return 60 * 60 * 1000;
  if (m === "btc_15m" || m === "eth_15m" || m === "usdt_15m" || m === "xrp_15m") return 15 * 60 * 1000;
  if (m === "btc_5m" || m === "eth_5m" || m === "usdt_5m" || m === "xrp_5m") return 5 * 60 * 1000;
  return ROLLING_4H_MS; // btc_4h 및 모든 *_4h 시장
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 대부분은 시 단위만, 분이 0이 아니면 분까지 포함. 15m/5m는 항상 분 포함. UTC ms → KST 표시 */
function formatKstDateTimeForMarket(utcMs: number, market: string): string {
  const kst = new Date(utcMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  const h = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  if (market === "btc_15m" || market === "btc_5m") {
    return `${y}년 ${mo}월 ${d}일 ${h}시 ${min}분`;
  }
  if (min !== 0) {
    return `${y}년 ${mo}월 ${d}일 ${h}시 ${min}분`;
  }
  return `${y}년 ${mo}월 ${d}일 ${h}시`;
}

/** 롤링 시장: 현재 봉 마감 시각(UTC ms). 봉 시작 + 주기 - 10초 조기 마감 */
function getRollingCloseUtcMs(market: SentimentMarket): number {
  const startAt = getCurrentCandleStartAt(market);
  return new Date(startAt).getTime() + getRollingPeriodMs(market) - VOTING_CLOSE_EARLY_MS;
}

/** 롤링 시장: 다음 봉 시작 시각(UTC ms) = 현재 봉 시작 + 주기 전체 */
function getNextCandleStartUtcMs(market: SentimentMarket): number {
  const startAt = getCurrentCandleStartAt(market);
  return new Date(startAt).getTime() + getRollingPeriodMs(market);
}

/** btc_1d/eth_1d/usdt_1d/xrp_1d: 현재 캔들 마감 시각(UTC ms) = candle_start_at + 24h - 10초 조기 마감 */
function getCoin1dCloseUtcMs(market: "btc_1d" | "eth_1d" | "usdt_1d" | "xrp_1d"): number {
  const startAt = getCurrentCandleStartAt(market);
  const periodMs = CANDLE_PERIOD_MS[market] ?? 24 * 60 * 60 * 1000;
  return new Date(startAt).getTime() + periodMs - VOTING_CLOSE_EARLY_MS;
}

/** KST 기준 현재 시각 (분 단위로 0시부터 경과) */
export function getKSTMinutesSinceMidnight(): number {
  const now = new Date();
  const utcMs = now.getTime();
  const kstMs = utcMs + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

/**
 * 투표 허용 여부.
 * - 코인 1d/롤링(btc_4h/1h/15m/5m 등): getRollingCloseUtcMs/getCoin1dCloseUtcMs 기준 + VOTING_CLOSE_EARLY_MS 적용
 * - 기타 시장(ndq, sp500, kospi, kosdaq 등): MARKET_CLOSE_KST 기준 시각에서 VOTING_CLOSE_EARLY_MS만큼 조기 마감
 */
export function isVotingOpenKST(market?: string): boolean {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  return getMillisUntilClose(m) > 0;
}

/** 마감 시각 라벨 (표기용). 4h/1h/15m/5m은 봉 종료 시점 */
export function getVotingCloseLabel(market?: string): string {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  if (m.endsWith("_4h")) return "투표 마감: 현재 4시간봉 종료 시";
  if (m === "btc_1h" || m === "eth_1h" || m === "usdt_1h" || m === "xrp_1h") return "투표 마감: 현재 1시간봉 종료 시";
  if (m === "btc_15m" || m === "eth_15m" || m === "usdt_15m" || m === "xrp_15m") return "투표 마감: 현재 15분봉 종료 시";
  if (m === "btc_5m" || m === "eth_5m" || m === "usdt_5m" || m === "xrp_5m") return "투표 마감: 현재 5분봉 종료 시";
  const { hour, minute } = MARKET_CLOSE_KST[m];
  const h = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return `투표 마감 시간 ${h}:${min}`;
}

/** @deprecated 비트코인 단일 시장용. getVotingCloseLabel('btc') 사용 권장 */
export const VOTING_CLOSE_LABEL = "투표 마감 시간 12:00";

/**
 * 해당 시장 마감 시각까지 남은 밀리초. 마감 후면 0 반환.
 * @param candleStartAt 폴의 candle_start_at (있으면 해당 폴 기준, 없으면 현재 봉)
 */
export function getMillisUntilClose(
  market?: string,
  candleStartAt?: string | null
): number {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  const isCoin1d = m === "btc_1d" || m === "eth_1d" || m === "usdt_1d" || m === "xrp_1d";
  const isKoreaMarket = m.startsWith("kospi_") || m.startsWith("kosdaq_") || m.startsWith("samsung_") || m.startsWith("skhynix_") || m.startsWith("hyundai_");
  if (isRollingMarket(m) || isCoin1d) {
    let closeUtcMs: number;
    if (candleStartAt && (isCoin1d || isRollingMarket(m))) {
      const periodMs = isCoin1d
        ? (CANDLE_PERIOD_MS[m] ?? 24 * 60 * 60 * 1000)
        : getRollingPeriodMs(m);
      closeUtcMs =
        new Date(candleStartAt).getTime() + periodMs - VOTING_CLOSE_EARLY_MS;
    } else if (isRollingMarket(m)) {
      closeUtcMs = getRollingCloseUtcMs(m);
    } else {
      closeUtcMs = getCoin1dCloseUtcMs(m as "btc_1d" | "eth_1d" | "usdt_1d" | "xrp_1d");
    }
    return Math.max(0, closeUtcMs - Date.now());
  }
  
  const utcMs = Date.now();
  const kst = new Date(utcMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const { hour, minute } = MARKET_CLOSE_KST[m];

  // 한국 시장: 거래일이 아니면(주말·휴장일) 항상 마감 상태. isTradingDayKST = 평일 + 휴장일 제외.
  if (isKoreaMarket && !isTradingDayKST(new Date())) {
    return 0;
  }

  // 기타 시장 (ndq, sp500, kospi, kosdaq 등)
  // MARKET_CLOSE_KST 기준 시각에서 VOTING_CLOSE_EARLY_MS만큼 조기 마감
  let closeUtcMs = Date.UTC(y, mo, d, hour - 9, minute, 0, 0) - VOTING_CLOSE_EARLY_MS;
  if (closeUtcMs <= utcMs) {
    // 코스피/코스닥 등 한국 지수 시장은 하루 단위 투표이므로,
    // 오늘 마감 시각이 지났다면 "오늘 폴"은 마감된 것으로 보고 0 반환.
    // (다음 영업일 폴은 새 round로 생성될 때 다시 open 처리)
    if (isKoreaMarket) {
      return 0;
    }
    // 기타 시장(ndq, sp500 등)은 다음 날 동일 시각까지 롤링 허용
    closeUtcMs = Date.UTC(y, mo, d + 1, hour - 9, minute, 0, 0) - VOTING_CLOSE_EARLY_MS;
  }
  return Math.max(0, closeUtcMs - utcMs);
}

/**
 * 마감 시각을 "연/월/일/시/분에 마감" 형식(KST)으로 반환.
 * LIVE 옆에 표기용.
 * @param market 시장
 * @param candleStartAt 폴의 candle_start_at (있으면 해당 폴 마감 시각 표시, 없으면 현재 봉 마감 시각)
 */
export function getCloseTimeKstString(
  market?: string,
  candleStartAt?: string | null
): string {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";

  // 폴의 candle_start_at이 있으면 해당 폴 마감 시각 사용 (표시는 항상 KST)
  // 표시: 봉 경계 시각(period 정각). 카운트다운은 period-1초까지 → UI 일치
  const isCoin1d = m === "btc_1d" || m === "eth_1d" || m === "usdt_1d" || m === "xrp_1d";
  const isKoreaMarket = m.startsWith("kospi_") || m.startsWith("kosdaq_") || m.startsWith("samsung_") || m.startsWith("skhynix_") || m.startsWith("hyundai_");
  if (candleStartAt && (isCoin1d || isRollingMarket(m) || isKoreaMarket)) {
    const periodMs =
      isCoin1d
        ? (CANDLE_PERIOD_MS[m] ?? 24 * 60 * 60 * 1000)
        : isKoreaMarket
          ? (CANDLE_PERIOD_MS[m] ?? 24 * 60 * 60 * 1000)
          : getRollingPeriodMs(m);
    const closeUtcMs =
      new Date(candleStartAt).getTime() + periodMs - VOTING_CLOSE_EARLY_MS;
    const boundaryUtcMs = closeUtcMs + VOTING_CLOSE_EARLY_MS;
    return `${formatKstDateTimeForMarket(boundaryUtcMs, m)}에 마감`;
  }

  if (isRollingMarket(m)) {
    const closeUtcMs = getRollingCloseUtcMs(m);
    const boundaryUtcMs = closeUtcMs + VOTING_CLOSE_EARLY_MS;
    return `${formatKstDateTimeForMarket(boundaryUtcMs, m)}에 마감`;
  }

  // btc_1d/eth_1d/usdt_1d: UTC 기준 통일 (KST 09:00 = UTC 00:00)
  if (isCoin1d) {
    const closeUtcMs = getCoin1dCloseUtcMs(m);
    const boundaryUtcMs = closeUtcMs + VOTING_CLOSE_EARLY_MS;
    return `${formatKstDateTimeForMarket(boundaryUtcMs, m)}에 마감`;
  }

  const utcMs = Date.now();
  const kst = new Date(utcMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const { hour, minute } = MARKET_CLOSE_KST[m];

  // 기타 시장 (ndq, sp500, kospi, kosdaq) — 마감 시각은 MARKET_CLOSE_KST(KST) → UTC로 변환 후 KST로 포맷
  let closeUtcMs = Date.UTC(y, mo, d, hour - 9, minute, 0, 0);
  if (closeUtcMs <= utcMs) {
    closeUtcMs = Date.UTC(y, mo, d + 1, hour - 9, minute, 0, 0);
  }
  return `${formatKstDateTimeForMarket(closeUtcMs, m)}에 마감`;
}

/**
 * 늦은 투표 프리미엄 배수 (구간별 고정)
 * - 50% 이상 남음: 1배
 * - 25~50%: 1.5배
 * - 10~25%: 3배
 * - 0~10%: 5배
 * - 0%: 마감 (투표 불가)
 */
export function getLateVotingMultiplier(market?: string): number {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  const remainingMs = getMillisUntilClose(m);
  if (remainingMs <= 0) return 0; // 마감됨

  let totalMs: number;
  if (isRollingMarket(m)) {
    totalMs = getRollingPeriodMs(m);
  } else if (m === "btc_1d" || m === "eth_1d" || m === "usdt_1d" || m === "xrp_1d") {
    totalMs = CANDLE_PERIOD_MS[m] ?? 24 * 60 * 60 * 1000;
  } else {
    totalMs = 24 * 60 * 60 * 1000; // ndq 등: 대략 24h
  }

  const ratio = remainingMs / totalMs;
  if (ratio >= 0.5) return 1;
  if (ratio >= 0.25) return 1.5;
  if (ratio >= 0.1) return 3;
  return 5;
}

/** 프리미엄 배수 설명 라벨 (UI용) */
export function getLateVotingMultiplierLabel(market?: string): string {
  const mult = getLateVotingMultiplier(market);
  if (mult <= 0) return "마감됨";
  if (mult === 1) return "투표권 1배 (마감 시간 50% 이상 남음)";
  if (mult === 1.5) return "투표권 1.5배 (마감 시간 25~50% 남음)";
  if (mult === 3) return "투표권 3배 (마감 시간 10~25% 남음)";
  if (mult === 5) return "투표권 5배 (마감 시간 10% 미만 남음)";
  return `투표권 ${mult}배`;
}

/**
 * 다음 투표 가능 시각을 "연/월/일/시/분부터" 형식(KST)으로 반환.
 * CLOSED 옆에 표기용. 모든 시각은 KST로 표시.
 */
export function getNextOpenTimeKstString(market?: string): string {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  if (isRollingMarket(m)) {
    const nextStartUtcMs = getNextCandleStartUtcMs(m);
    return `${formatKstDateTimeForMarket(nextStartUtcMs, m)}부터`;
  }
  // btc_1d/eth_1d/usdt_1d/xrp_1d: 마감 직후(UTC 00:00 = KST 09:00)에 새 투표 시작
  if (m === "btc_1d" || m === "eth_1d" || m === "usdt_1d" || m === "xrp_1d") {
    const nextStartUtcMs = getCoin1dCloseUtcMs(m);
    return `${formatKstDateTimeForMarket(nextStartUtcMs, m)}부터`;
  }
  const utcMs = Date.now();
  const kst = new Date(utcMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const h = kst.getUTCHours();
  const min = kst.getUTCMinutes();

  // 한국 지수: 전부 KST 기준으로 다음 투표 시각 계산
  const isKorea1d = m === "kospi_1d" || m === "kosdaq_1d" || m === "samsung_1d" || m === "skhynix_1d" || m === "hyundai_1d";
  const isKorea1h = m === "kospi_1h" || m === "kosdaq_1h" || m === "samsung_1h" || m === "skhynix_1h" || m === "hyundai_1h";
  if (isKorea1d) {
    // 1일봉: 다음 거래일 09:00 KST (09:00 KST = 00:00 UTC 해당일)
    const nextOpenUtcMs = Date.UTC(y, mo, d + 1, 0, 0, 0, 0);
    return `${formatKstDateTimeForMarket(nextOpenUtcMs, m)}부터`;
  }
  if (isKorea1h) {
    // 1시간봉: 15:00 KST 이전이면 다음 시 정각 KST, 이후면 다음날 09:00 KST
    const afterClose = h > 15 || (h === 15 && min >= 0);
    if (afterClose) {
      const nextOpenUtcMs = Date.UTC(y, mo, d + 1, 0, 0, 0, 0);
      return `${formatKstDateTimeForMarket(nextOpenUtcMs, m)}부터`;
    }
    const nextHourKst = h + 1;
    const nextOpenUtcMs = Date.UTC(y, mo, d, nextHourKst - 9, 0, 0, 0);
    return `${formatKstDateTimeForMarket(nextOpenUtcMs, m)}부터`;
  }

  // 기타 시장(ndq, sp500 등): 기존 로직 유지 (15:00 UTC = 자정 KST)
  const nextOpenUtcMs = Date.UTC(y, mo, d, 15, 0, 0, 0);
  return `${formatKstDateTimeForMarket(nextOpenUtcMs, m)}부터`;
}
