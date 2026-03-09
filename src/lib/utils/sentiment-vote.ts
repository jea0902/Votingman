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

/** 4h/1h/15m/5m: 주기 절반(기존 마감 시각, 현재 사용하지 않음) — 밀리초 */
const ROLLING_HALF_PERIOD_MS: Record<"btc_4h" | "btc_1h" | "btc_15m" | "btc_5m", number> = {
  btc_4h: 2 * 60 * 60 * 1000,
  btc_1h: 30 * 60 * 1000,
  btc_15m: 7.5 * 60 * 1000,
  btc_5m: 2.5 * 60 * 1000,
};

const ROLLING_MARKETS: SentimentMarket[] = ["btc_4h", "btc_1h", "btc_15m", "btc_5m"];

function isRollingMarket(m: SentimentMarket): m is "btc_4h" | "btc_1h" | "btc_15m" | "btc_5m" {
  return ROLLING_MARKETS.includes(m);
}

/** 롤링 시장: 주기 전체(다음 봉 시작까지) — 밀리초 */
const ROLLING_FULL_PERIOD_MS: Record<"btc_4h" | "btc_1h" | "btc_15m" | "btc_5m", number> = {
  btc_4h: 4 * 60 * 60 * 1000,
  btc_1h: 60 * 60 * 1000,
  btc_15m: 15 * 60 * 1000,
  btc_5m: 5 * 60 * 1000,
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 1d/4h/1h는 분 생략, 15m/5m는 분 포함. UTC ms → KST 표시 */
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
  return `${y}년 ${mo}월 ${d}일 ${h}시`;
}

/** 롤링 시장: 현재 봉 마감 시각(UTC ms). 봉 시작 + 주기 - 10초 조기 마감 */
function getRollingCloseUtcMs(market: "btc_4h" | "btc_1h" | "btc_15m" | "btc_5m"): number {
  const startAt = getCurrentCandleStartAt(market);
  return new Date(startAt).getTime() + ROLLING_FULL_PERIOD_MS[market] - VOTING_CLOSE_EARLY_MS;
}

/** 롤링 시장: 다음 봉 시작 시각(UTC ms) = 현재 봉 시작 + 주기 전체 */
function getNextCandleStartUtcMs(market: "btc_4h" | "btc_1h" | "btc_15m" | "btc_5m"): number {
  const startAt = getCurrentCandleStartAt(market);
  return new Date(startAt).getTime() + ROLLING_FULL_PERIOD_MS[market];
}

/** btc_1d: 현재 캔들 마감 시각(UTC ms) = candle_start_at + 24h - 10초 조기 마감 */
function getBtc1dCloseUtcMs(): number {
  const startAt = getCurrentCandleStartAt("btc_1d");
  const periodMs = CANDLE_PERIOD_MS["btc_1d"] ?? 24 * 60 * 60 * 1000;
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
 * 해당 시장 마감 시각(KST)까지 분 단위. 0시 = 0, 09:00 = 9*60.
 * 롤링 시장(4h/1h/15m)에서는 사용하지 않음.
 */
function getCloseMinutes(market: SentimentMarket): number {
  const { hour, minute } = MARKET_CLOSE_KST[market];
  return hour * 60 + minute;
}

/**
 * 투표 허용 여부.
 * - 1일봉: KST 09:01~다음날 09:00 허용 (정산 완료 후 새 투표 시작)
 * - 주식: 당일 해당 시장 마감 시각 전이면 허용
 * - 4h/1h/15m: 현재 봉 종료까지 허용
 */
export function isVotingOpenKST(market?: string): boolean {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  if (isRollingMarket(m)) {
    return Date.now() < getRollingCloseUtcMs(m);
  }
  
  // btc_1d: UTC 기준 통일. 10초 조기 마감 적용 (getBtc1dCloseUtcMs와 동일)
  if (m === "btc_1d") {
    return Date.now() < getBtc1dCloseUtcMs();
  }
  
  // 기타 시장 (ndq, sp500, kospi, kosdaq)
  const mins = getKSTMinutesSinceMidnight();
  const closeAt = getCloseMinutes(m);
  return mins < closeAt;
}

/** 마감 시각 라벨 (표기용). 4h/1h/15m/5m은 봉 종료 시점 */
export function getVotingCloseLabel(market?: string): string {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  if (m === "btc_4h") return "투표 마감: 현재 4시간봉 종료 시";
  if (m === "btc_1h") return "투표 마감: 현재 1시간봉 종료 시";
  if (m === "btc_15m") return "투표 마감: 현재 15분봉 종료 시";
  if (m === "btc_5m") return "투표 마감: 현재 5분봉 종료 시";
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
  if (isRollingMarket(m) || m === "btc_1d") {
    let closeUtcMs: number;
    if (candleStartAt && (m === "btc_1d" || isRollingMarket(m))) {
      const periodMs =
        m === "btc_1d"
          ? (CANDLE_PERIOD_MS["btc_1d"] ?? 24 * 60 * 60 * 1000)
          : ROLLING_FULL_PERIOD_MS[m];
      closeUtcMs =
        new Date(candleStartAt).getTime() + periodMs - VOTING_CLOSE_EARLY_MS;
    } else if (isRollingMarket(m)) {
      closeUtcMs = getRollingCloseUtcMs(m);
    } else {
      closeUtcMs = getBtc1dCloseUtcMs();
    }
    return Math.max(0, closeUtcMs - Date.now());
  }
  
  const utcMs = Date.now();
  const kst = new Date(utcMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const { hour, minute } = MARKET_CLOSE_KST[m];
  
  // 기타 시장 (ndq, sp500, kospi, kosdaq)
  let closeUtcMs = Date.UTC(y, mo, d, hour - 9, minute, 0, 0);
  if (closeUtcMs <= utcMs) {
    closeUtcMs = Date.UTC(y, mo, d + 1, hour - 9, minute, 0, 0);
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

  // 폴의 candle_start_at이 있으면 해당 폴 마감 시각 사용
  // 표시: 봉 경계 시각(period 정각). 카운트다운은 period-1초까지 → UI 일치
  if (candleStartAt && (m === "btc_1d" || isRollingMarket(m))) {
    const periodMs =
      m === "btc_1d"
        ? (CANDLE_PERIOD_MS["btc_1d"] ?? 24 * 60 * 60 * 1000)
        : ROLLING_FULL_PERIOD_MS[m];
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

  // btc_1d: UTC 기준 통일 (KST 09:00 = UTC 00:00)
  if (m === "btc_1d") {
    const closeUtcMs = getBtc1dCloseUtcMs();
    const boundaryUtcMs = closeUtcMs + VOTING_CLOSE_EARLY_MS;
    return `${formatKstDateTimeForMarket(boundaryUtcMs, m)}에 마감`;
  }

  const utcMs = Date.now();
  const kst = new Date(utcMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const { hour, minute } = MARKET_CLOSE_KST[m];

  // 기타 시장 (ndq, sp500, kospi, kosdaq)
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
    totalMs = ROLLING_FULL_PERIOD_MS[m];
  } else if (m === "btc_1d") {
    totalMs = CANDLE_PERIOD_MS["btc_1d"] ?? 24 * 60 * 60 * 1000;
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
 * CLOSED 옆에 표기용.
 */
export function getNextOpenTimeKstString(market?: string): string {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  if (isRollingMarket(m)) {
    const nextStartUtcMs = getNextCandleStartUtcMs(m);
    return `${formatKstDateTimeForMarket(nextStartUtcMs, m)}부터`;
  }
  // btc_1d: 마감 직후(UTC 00:00 = KST 09:00)에 새 투표 시작
  if (m === "btc_1d") {
    const nextStartUtcMs = getBtc1dCloseUtcMs();
    return `${formatKstDateTimeForMarket(nextStartUtcMs, m)}부터`;
  }
  const utcMs = Date.now();
  const kst = new Date(utcMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const nextOpenUtcMs = Date.UTC(y, mo, d, 15, 0, 0, 0);
  return `${formatKstDateTimeForMarket(nextOpenUtcMs, m)}부터`;
}
