/**
 * 인간 지표(데일리 투표) 관련 유틸
 *
 * 설계 의도:
 * - 1일봉(btc_1d): 당일 KST 20:30 고정 마감
 * - 4h/1h/15m: 현재 봉 시작 시각 + 주기 절반에 마감 (롤링)
 * - 미국/한국 주식: 시장별 고정 시각 (KST)
 */

import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import {
  MARKET_CLOSE_KST,
  isSentimentMarket,
} from "@/lib/constants/sentiment-markets";
import { getCurrentCandleStartAt } from "@/lib/btc-ohlc/candle-utils";

/** 4h/1h/15m: 주기 절반(마감 시각) — 밀리초 */
const ROLLING_HALF_PERIOD_MS: Record<"btc_4h" | "btc_1h" | "btc_15m", number> = {
  btc_4h: 2 * 60 * 60 * 1000,
  btc_1h: 30 * 60 * 1000,
  btc_15m: 7.5 * 60 * 1000,
};

const ROLLING_MARKETS: SentimentMarket[] = ["btc_4h", "btc_1h", "btc_15m"];

function isRollingMarket(m: SentimentMarket): m is "btc_4h" | "btc_1h" | "btc_15m" {
  return ROLLING_MARKETS.includes(m);
}

/** 롤링 시장: 주기 전체(다음 봉 시작까지) — 밀리초 */
const ROLLING_FULL_PERIOD_MS: Record<"btc_4h" | "btc_1h" | "btc_15m", number> = {
  btc_4h: 4 * 60 * 60 * 1000,
  btc_1h: 60 * 60 * 1000,
  btc_15m: 15 * 60 * 1000,
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 1d/4h/1h는 분 생략, 15m는 분 포함 */
function formatKstDateTimeForMarket(utcMs: number, market: string): string {
  const kst = new Date(utcMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  const h = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  if (market === "btc_15m") {
    return `${y}년 ${mo}월 ${d}일 ${h}시 ${min}분`;
  }
  return `${y}년 ${mo}월 ${d}일 ${h}시`;
}

/** 롤링 시장: 현재 봉 마감 시각(UTC ms). 봉 시작 + 주기 절반 */
function getRollingCloseUtcMs(market: "btc_4h" | "btc_1h" | "btc_15m"): number {
  const startAt = getCurrentCandleStartAt(market);
  return new Date(startAt).getTime() + ROLLING_HALF_PERIOD_MS[market];
}

/** 롤링 시장: 다음 봉 시작 시각(UTC ms) = 현재 봉 시작 + 주기 전체 */
function getNextCandleStartUtcMs(market: "btc_4h" | "btc_1h" | "btc_15m"): number {
  const startAt = getCurrentCandleStartAt(market);
  return new Date(startAt).getTime() + ROLLING_FULL_PERIOD_MS[market];
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
 * 해당 시장 마감 시각(KST)까지 분 단위. 0시 = 0, 20:30 = 20*60+30.
 * 롤링 시장(4h/1h/15m)에서는 사용하지 않음.
 */
function getCloseMinutes(market: SentimentMarket): number {
  const { hour, minute } = MARKET_CLOSE_KST[market];
  return hour * 60 + minute;
}

/**
 * 투표 허용 여부.
 * - 1일봉/주식: 당일 해당 시장 마감 시각 전이면 허용
 * - 4h/1h/15m: 현재 봉 시작 + 주기 절반 이전이면 허용
 */
export function isVotingOpenKST(market?: string): boolean {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  if (isRollingMarket(m)) {
    return Date.now() < getRollingCloseUtcMs(m);
  }
  const mins = getKSTMinutesSinceMidnight();
  const closeAt = getCloseMinutes(m);
  return mins < closeAt;
}

/** 마감 시각 라벨 (표기용). 4h/1h/15m은 "현재 봉 시작 후 N" 형식. */
export function getVotingCloseLabel(market?: string): string {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  if (m === "btc_4h") return "투표 마감: 현재 4시간봉 시작 후 2시간";
  if (m === "btc_1h") return "투표 마감: 현재 1시간봉 시작 후 30분";
  if (m === "btc_15m") return "투표 마감: 현재 15분봉 시작 후 7분 30초";
  const { hour, minute } = MARKET_CLOSE_KST[m];
  const h = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return `투표 마감 시간 ${h}:${min}`;
}

/** @deprecated 비트코인 단일 시장용. getVotingCloseLabel('btc') 사용 권장 */
export const VOTING_CLOSE_LABEL = "투표 마감 시간 20:30";

/**
 * 해당 시장 마감 시각까지 남은 밀리초. 마감 후면 0 반환.
 * 롤링 시장(4h/1h/15m): 현재 봉 시작 + 주기 절반까지.
 */
export function getMillisUntilClose(market?: string): number {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  if (isRollingMarket(m)) {
    const closeUtcMs = getRollingCloseUtcMs(m);
    return Math.max(0, closeUtcMs - Date.now());
  }
  const utcMs = Date.now();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(utcMs + kstOffset);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const { hour, minute } = MARKET_CLOSE_KST[m];
  let closeUtcMs = Date.UTC(y, mo, d, hour - 9, minute, 0, 0);
  if (closeUtcMs <= utcMs) {
    closeUtcMs = Date.UTC(y, mo, d + 1, hour - 9, minute, 0, 0);
  }
  return Math.max(0, closeUtcMs - utcMs);
}

/**
 * 마감 시각을 "연/월/일/시/분에 마감" 형식(KST)으로 반환.
 * LIVE 옆에 표기용.
 */
export function getCloseTimeKstString(market?: string): string {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc_1d";
  if (isRollingMarket(m)) {
    const closeUtcMs = getRollingCloseUtcMs(m);
    return `${formatKstDateTimeForMarket(closeUtcMs, m)}에 마감`;
  }
  const utcMs = Date.now();
  const kst = new Date(utcMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const { hour, minute } = MARKET_CLOSE_KST[m];
  let closeUtcMs = Date.UTC(y, mo, d, hour - 9, minute, 0, 0);
  if (closeUtcMs <= utcMs) {
    closeUtcMs = Date.UTC(y, mo, d + 1, hour - 9, minute, 0, 0);
  }
  return `${formatKstDateTimeForMarket(closeUtcMs, m)}에 마감`;
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
  const utcMs = Date.now();
  const kst = new Date(utcMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const nextOpenUtcMs = Date.UTC(y, mo, d, 15, 0, 0, 0);
  return `${formatKstDateTimeForMarket(nextOpenUtcMs, m)}부터`;
}
