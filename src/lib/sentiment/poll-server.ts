/**
 * 서버 전용: sentiment_polls 행 조회 또는 생성
 * - (market, candle_start_at) 기준. poll_date는 조회 편의용
 * - btc 시장: btc_ohlc에서 open/close 조회 (종가끼리 비교 정산)
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getTodayKstDateString } from "@/lib/binance/btc-kst";
import {
  getBtc1dCandleStartAt,
  getCurrentCandleStartAt,
} from "@/lib/btc-ohlc/candle-utils";
import type { SentimentPollRow } from "@/lib/supabase/db-types";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import { isSentimentMarket } from "@/lib/constants/sentiment-markets";

export type TodayPollResult = {
  poll: SentimentPollRow;
  created: boolean;
};

const BTC_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;

/**
 * 오늘(KST) 현재 진행 중인 캔들에 해당하는 폴 조회/생성
 * btc_1d: 오늘 00:00 캔들. btc_4h/1h/15m: 현재 진행 중인 캔들
 * ndq/sp500/kospi/kosdaq: 오늘 00:00 기준 (일봉)
 */
export async function getOrCreateTodayPollByMarket(
  market: string
): Promise<TodayPollResult> {
  const m: SentimentMarket = isSentimentMarket(market) ? market : "btc_1d";
  const todayKst = getTodayKstDateString();
  const candleStartAt = BTC_MARKETS.includes(m as (typeof BTC_MARKETS)[number])
    ? getCurrentCandleStartAt(m)
    : getBtc1dCandleStartAt(todayKst); // ndq 등: KST 일봉 기준
  return getOrCreatePollByMarketAndCandleStartAt(m, candleStartAt, todayKst);
}

/**
 * (market, candle_start_at) 기준 폴 조회/생성
 */
export async function getOrCreatePollByMarketAndCandleStartAt(
  market: SentimentMarket,
  candleStartAt: string,
  pollDate?: string
): Promise<TodayPollResult> {
  const admin = createSupabaseAdmin();
  const date = pollDate != null ? pollDate : pollDateFromCandleStartAt(candleStartAt);

  const { data: existing } = await admin
    .from("sentiment_polls")
    .select("*")
    .eq("market", market)
    .eq("candle_start_at", candleStartAt)
    .maybeSingle();

  if (existing) {
    return { poll: existing as SentimentPollRow, created: false };
  }

  const { data: inserted, error } = await admin
    .from("sentiment_polls")
    .insert({
      poll_date: date,
      market,
      candle_start_at: candleStartAt,
      long_count: 0,
      short_count: 0,
      long_coin_total: 0,
      short_coin_total: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return { poll: inserted as SentimentPollRow, created: true };
}

function pollDateFromCandleStartAt(candleStartAt: string): string {
  const d = new Date(candleStartAt);
  const kstMs = d.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * 오늘 비트코인 폴만 조회/생성. 기존 호환용.
 */
export async function getOrCreateTodayPoll(): Promise<TodayPollResult> {
  return getOrCreateTodayPollByMarket("btc_1d");
}

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 특정 poll_date + market에 해당하는 폴(들) 조회/생성.
 * btc_1d: 1개. btc_4h: 6개, btc_1h: 24개, btc_15m: 96개
 */
export async function getOrCreatePollByDateAndMarket(
  pollDate: string,
  market: string
): Promise<{ poll: SentimentPollRow; created: boolean }> {
  if (!POLL_DATE_REGEX.test(pollDate)) {
    throw new Error("poll_date must be YYYY-MM-DD");
  }
  const m: SentimentMarket = isSentimentMarket(market) ? market : "btc_1d";

  const { getCandlesForPollDate } = await import("@/lib/btc-ohlc/candle-utils");
  const candleStartAts = getCandlesForPollDate(m, pollDate);
  if (candleStartAts.length === 0) {
    throw new Error(`Unsupported market: ${market}`);
  }

  // btc_1d만 호출 시 첫 번째(유일한) 캔들 사용
  const candleStartAt = candleStartAts[0];
  const result = await getOrCreatePollByMarketAndCandleStartAt(
    m,
    candleStartAt,
    pollDate
  );
  return result;
}
