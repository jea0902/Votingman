/**
 * 서버 전용: 오늘(KST) sentiment_polls 행 조회 또는 생성
 * - GET poll API, POST vote API에서 공통 사용
 * - 시장별 폴: btc(비트코인), ndq/sp500(미국), kospi/kosdaq(한국)
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  fetchBtcOpenCloseKst,
  getTodayKstDateString,
} from "@/lib/binance/btc-kst";
import type { SentimentPollRow } from "@/lib/supabase/db-types";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import { isSentimentMarket } from "@/lib/constants/sentiment-markets";

export type TodayPollResult = {
  poll: SentimentPollRow;
  created: boolean;
};

/**
 * 오늘(KST) poll_date + market에 해당하는 행을 조회. 없으면 생성 후 반환.
 * btc: Binance로 시가 조회. 그 외 시장: open/close는 null(추후 데이터 연동).
 */
export async function getOrCreateTodayPollByMarket(
  market: string
): Promise<TodayPollResult> {
  const m: SentimentMarket = isSentimentMarket(market) ? market : "btc";
  const admin = createSupabaseAdmin();
  const today = getTodayKstDateString();

  const { data: existing } = await admin
    .from("sentiment_polls")
    .select("*")
    .eq("poll_date", today)
    .eq("market", m)
    .maybeSingle();

  if (existing) {
    return {
      poll: existing as SentimentPollRow,
      created: false,
    };
  }

  let openValue: number | null = null;
  if (m === "btc") {
    const { btc_open } = await fetchBtcOpenCloseKst(today);
    openValue = btc_open != null ? Math.round(btc_open * 100) / 100 : null;
  }

  const { data: inserted, error } = await admin
    .from("sentiment_polls")
    .insert({
      poll_date: today,
      market: m,
      btc_open: openValue,
      btc_close: null,
      long_count: 0,
      short_count: 0,
      long_coin_total: 0,
      short_coin_total: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    poll: inserted as SentimentPollRow,
    created: true,
  };
}

/**
 * 오늘 비트코인 폴만 조회/생성. 기존 호환용.
 */
export async function getOrCreateTodayPoll(): Promise<TodayPollResult> {
  return getOrCreateTodayPollByMarket("btc");
}

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 특정 poll_date + market에 해당하는 폴 행 조회. 없으면 생성 후 반환.
 * 크론 등에서 투표 유무와 무관하게 "그날 그 시장" 행을 만들 때 사용.
 */
export async function getOrCreatePollByDateAndMarket(
  pollDate: string,
  market: string
): Promise<{ poll: SentimentPollRow; created: boolean }> {
  if (!POLL_DATE_REGEX.test(pollDate)) {
    throw new Error("poll_date must be YYYY-MM-DD");
  }
  const m: SentimentMarket = isSentimentMarket(market) ? market : "btc";
  const admin = createSupabaseAdmin();

  const { data: existing } = await admin
    .from("sentiment_polls")
    .select("*")
    .eq("poll_date", pollDate)
    .eq("market", m)
    .maybeSingle();

  if (existing) {
    return { poll: existing as SentimentPollRow, created: false };
  }

  const { data: inserted, error } = await admin
    .from("sentiment_polls")
    .insert({
      poll_date: pollDate,
      market: m,
      btc_open: null,
      btc_close: null,
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
