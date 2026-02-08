/**
 * 인간 지표(데일리 투표) 관련 유틸
 *
 * 설계 의도:
 * - 시장별 마감: 비트코인 20:30, 미국 주식 03:30, 한국 주식 13:00 (KST)
 * - KST 기준 현재 시각으로 마감 여부 판단 (클라이언트/서버 공용)
 */

import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import {
  MARKET_CLOSE_KST,
  isSentimentMarket,
} from "@/lib/constants/sentiment-markets";

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
 */
function getCloseMinutes(market: SentimentMarket): number {
  const { hour, minute } = MARKET_CLOSE_KST[market];
  return hour * 60 + minute;
}

/**
 * 오늘 KST 00:00 ~ 해당 시장 마감 시각 전이면 투표 허용.
 * market 미지정 시 비트코인(20:30) 기준. 클라이언트·서버 공용.
 */
export function isVotingOpenKST(market?: string): boolean {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc";
  const mins = getKSTMinutesSinceMidnight();
  const closeAt = getCloseMinutes(m);
  return mins < closeAt;
}

/** 마감 시각 라벨 (표기용). market 미지정 시 비트코인 기준. */
export function getVotingCloseLabel(market?: string): string {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc";
  const { hour, minute } = MARKET_CLOSE_KST[m];
  const h = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return `투표 마감 시간 ${h}:${min}`;
}

/** @deprecated 비트코인 단일 시장용. getVotingCloseLabel('btc') 사용 권장 */
export const VOTING_CLOSE_LABEL = "투표 마감 시간 20:30";

/**
 * 해당 시장 마감 시각(한국 시간)까지 남은 밀리초. 마감 후면 0 반환.
 */
export function getMillisUntilClose(market?: string): number {
  const m: SentimentMarket = market && isSentimentMarket(market) ? market : "btc";
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
