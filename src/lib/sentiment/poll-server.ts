/**
 * 서버 전용: 오늘(KST) sentiment_polls 행 조회 또는 생성
 * - GET poll API, POST vote API에서 공통 사용
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  fetchBtcOpenCloseKst,
  getTodayKstDateString,
} from "@/lib/binance/btc-kst";
import type { SentimentPollRow } from "@/lib/supabase/db-types";

export type TodayPollResult = {
  poll: SentimentPollRow;
  created: boolean;
};

/**
 * 오늘(KST) poll_date에 해당하는 행을 조회. 없으면 생성 후 반환.
 * 생성 시 btc_open은 Binance API로 조회해 넣음.
 */
export async function getOrCreateTodayPoll(): Promise<TodayPollResult> {
  const admin = createSupabaseAdmin();
  const today = getTodayKstDateString();

  const { data: existing } = await admin
    .from("sentiment_polls")
    .select("*")
    .eq("poll_date", today)
    .eq("market", "btc")
    .maybeSingle();

  if (existing) {
    return {
      poll: existing as SentimentPollRow,
      created: false,
    };
  }

  const { btc_open } = await fetchBtcOpenCloseKst(today);
  const btcOpenRounded =
    btc_open != null ? Math.round(btc_open * 100) / 100 : null;

  const { data: inserted, error } = await admin
    .from("sentiment_polls")
    .insert({
      poll_date: today,
      market: "btc",
      btc_open: btcOpenRounded,
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
