/**
 * 보팅맨 정산(마감 후 처리) 서비스
 * 명세: docs/votingman-implementation-phases.md 3단계
 *
 * - 단독 참여(무효판): 참여 1명 이하 → 전액 환불, payout_history 없음
 * - 한쪽 쏠림: 롱만 or 숏만 → 전원 원금 환불, payout_history 당첨자만 payout_amount=0
 * - 정상: 패자 풀을 승자에게 베팅 비율 분배, 당첨자 잔액 += 원금 + 수령분
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { fetchBtcOpenCloseKst } from "@/lib/binance/btc-kst";
import type { SentimentPollRow } from "@/lib/supabase/db-types";

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type SettlementResult = {
  poll_id: string;
  poll_date: string;
  market: string | null;
  status: "already_settled" | "invalid_refund" | "one_side_refund" | "draw_refund" | "settled";
  participant_count: number;
  winner_side: "long" | "short" | null;
  refunded_user_count?: number;
  winner_count?: number;
  loser_pool?: number;
  payout_total?: number;
  error?: string;
};

/**
 * 비트코인 폴의 시가·종가를 Binance에서 가져와 DB에 반영 (소수점 둘째자리까지)
 */
export async function updateBtcOhlcForPoll(
  pollDate: string,
  pollId: string
): Promise<{ price_open: number | null; price_close: number | null }> {
  if (!POLL_DATE_REGEX.test(pollDate)) {
    throw new Error("poll_date must be YYYY-MM-DD");
  }
  const result = await fetchBtcOpenCloseKst(pollDate);
  const price_open =
    result.btc_open != null ? Math.round(result.btc_open * 100) / 100 : null;
  const price_close =
    result.btc_close != null ? Math.round(result.btc_close * 100) / 100 : null;

  const admin = createSupabaseAdmin();
  const updates: { price_open?: number | null; price_close?: number | null; change_pct?: number | null } = {};
  if (price_open != null) updates.price_open = price_open;
  if (price_close != null) updates.price_close = price_close;
  if (price_open != null && price_close != null && price_open > 0) {
    updates.change_pct = Math.round((price_close - price_open) / price_open * 10000) / 10000;
  }
  if (Object.keys(updates).length > 0) {
    await admin
      .from("sentiment_polls")
      .update(updates)
      .eq("id", pollId);
  }
  return { price_open, price_close };
}

/**
 * 단일 폴 정산 실행
 * - poll_date: YYYY-MM-DD (KST 기준)
 * - market: btc 등. btc인 경우 시가/종가 없으면 Binance에서 조회 후 반영 시도
 */
export async function settlePoll(
  pollDate: string,
  market: string
): Promise<SettlementResult> {
  if (!POLL_DATE_REGEX.test(pollDate)) {
    return {
      poll_id: "",
      poll_date: pollDate,
      market,
      status: "already_settled",
      participant_count: 0,
      winner_side: null,
      error: "poll_date must be YYYY-MM-DD",
    };
  }

  const admin = createSupabaseAdmin();

  const { data: poll, error: pollError } = await admin
    .from("sentiment_polls")
    .select("*")
    .eq("poll_date", pollDate)
    .eq("market", market)
    .maybeSingle();

  if (pollError || !poll) {
    return {
      poll_id: "",
      poll_date: pollDate,
      market,
      status: "already_settled",
      participant_count: 0,
      winner_side: null,
      error: pollError?.message ?? "폴을 찾을 수 없습니다.",
    };
  }

  const pollRow = poll as SentimentPollRow & { settled_at?: string | null };
  const pollId = pollRow.id;

  if (pollRow.settled_at) {
    return {
      poll_id: pollId,
      poll_date: pollDate,
      market: pollRow.market ?? market,
      status: "already_settled",
      participant_count: 0,
      winner_side: null,
    };
  }

  // btc 시장이면 시가/종가 없을 때 Binance에서 조회 후 반영
  let price_open = pollRow.price_open != null ? Number(pollRow.price_open) : null;
  let price_close = pollRow.price_close != null ? Number(pollRow.price_close) : null;
  if (market === "btc" && (price_open == null || price_close == null)) {
    const updated = await updateBtcOhlcForPoll(pollDate, pollId);
    price_open = updated.price_open ?? price_open;
    price_close = updated.price_close ?? price_close;
  }

  const longCoinTotal = Number(pollRow.long_coin_total ?? 0);
  const shortCoinTotal = Number(pollRow.short_coin_total ?? 0);

  const { data: votes } = await admin
    .from("sentiment_votes")
    .select("user_id, choice, bet_amount")
    .eq("poll_id", pollId)
    .gt("bet_amount", 0)
    .not("user_id", "is", null);

  const participantIds = [...new Set((votes ?? []).map((v) => v.user_id as string))];
  const participantCount = participantIds.length;

  // 단독 참여(무효판): 1명 이하 → 전액 환불, payout_history 없음
  if (participantCount <= 1) {
    for (const v of votes ?? []) {
      if (!v.user_id) continue;
      const refund = Number(v.bet_amount ?? 0);
      if (refund <= 0) continue;
      const { data: u } = await admin
        .from("users")
        .select("voting_coin_balance")
        .eq("user_id", v.user_id)
        .single();
      const current = Number(u?.voting_coin_balance ?? 0);
      await admin
        .from("users")
        .update({ voting_coin_balance: current + refund })
        .eq("user_id", v.user_id);
    }
    await admin
      .from("sentiment_polls")
      .update({ settled_at: new Date().toISOString() })
      .eq("id", pollId);
    return {
      poll_id: pollId,
      poll_date: pollDate,
      market: pollRow.market ?? market,
      status: "invalid_refund",
      participant_count: participantCount,
      winner_side: null,
      refunded_user_count: votes?.length ?? 0,
    };
  }

  // 한쪽 쏠림: 롱만 or 숏만 → 전원 원금 환불
  if (longCoinTotal === 0 || shortCoinTotal === 0) {
    for (const v of votes ?? []) {
      if (!v.user_id) continue;
      const refund = Number(v.bet_amount ?? 0);
      if (refund <= 0) continue;
      const { data: u } = await admin
        .from("users")
        .select("voting_coin_balance")
        .eq("user_id", v.user_id)
        .single();
      const current = Number(u?.voting_coin_balance ?? 0);
      await admin
        .from("users")
        .update({ voting_coin_balance: current + refund })
        .eq("user_id", v.user_id);
    }
    const winnerChoice = longCoinTotal > 0 ? "long" : "short";
    for (const v of votes ?? []) {
      if (!v.user_id || v.choice !== winnerChoice) continue;
      await admin.from("payout_history").insert({
        poll_id: pollId,
        user_id: v.user_id,
        market: pollRow.market ?? market,
        bet_amount: Number(v.bet_amount ?? 0),
        payout_amount: 0,
      });
    }
    await admin
      .from("sentiment_polls")
      .update({ settled_at: new Date().toISOString() })
      .eq("id", pollId);
    return {
      poll_id: pollId,
      poll_date: pollDate,
      market: pollRow.market ?? market,
      status: "one_side_refund",
      participant_count: participantCount,
      winner_side: winnerChoice,
      refunded_user_count: votes?.length ?? 0,
    };
  }

  // 현재 비트코인 시장만 정산 지원 (시가/종가 DB·수집이 btc만 구현됨)
  if (market !== "btc") {
    return {
      poll_id: pollId,
      poll_date: pollDate,
      market: pollRow.market ?? market,
      status: "already_settled",
      participant_count: participantCount,
      winner_side: null,
      error: "현재 비트코인(btc) 시장만 정산을 지원합니다.",
    };
  }
  if (price_open == null || price_close == null) {
    return {
      poll_id: pollId,
      poll_date: pollDate,
      market: pollRow.market ?? market,
      status: "already_settled",
      participant_count: participantCount,
      winner_side: null,
      error: "비트코인 종가가 아직 없습니다. 다음날 KST 00:00 이후 다시 시도하세요.",
    };
  }

  // 시가 == 종가(동일가): 당첨자 없음, 전원 원금 환불
  if (price_open === price_close) {
    for (const v of votes ?? []) {
      if (!v.user_id) continue;
      const refund = Number(v.bet_amount ?? 0);
      if (refund <= 0) continue;
      const { data: u } = await admin
        .from("users")
        .select("voting_coin_balance")
        .eq("user_id", v.user_id)
        .single();
      const current = Number(u?.voting_coin_balance ?? 0);
      await admin
        .from("users")
        .update({ voting_coin_balance: current + refund })
        .eq("user_id", v.user_id);
    }
    await admin
      .from("sentiment_polls")
      .update({ settled_at: new Date().toISOString() })
      .eq("id", pollId);
    return {
      poll_id: pollId,
      poll_date: pollDate,
      market: pollRow.market ?? market,
      status: "draw_refund",
      participant_count: participantCount,
      winner_side: null,
      refunded_user_count: votes?.length ?? 0,
    };
  }

  const winnerSide: "long" | "short" = price_close > price_open ? "long" : "short";
  const loserPool = winnerSide === "long" ? shortCoinTotal : longCoinTotal;
  const winnerTotalBet = winnerSide === "long" ? longCoinTotal : shortCoinTotal;
  const winnerVotes = (votes ?? []).filter((v) => v.choice === winnerSide);

  let payoutTotal = 0;
  for (const v of winnerVotes) {
    if (!v.user_id) continue;
    const bet = Number(v.bet_amount ?? 0);
    const payout =
      winnerTotalBet > 0 ? (loserPool * bet) / winnerTotalBet : 0;
    const payoutRounded = Math.round(payout * 100) / 100;
    payoutTotal += payoutRounded;
    const toAdd = bet + payoutRounded;
    const { data: u } = await admin
      .from("users")
      .select("voting_coin_balance")
      .eq("user_id", v.user_id)
      .single();
    const current = Number(u?.voting_coin_balance ?? 0);
    await admin
      .from("users")
      .update({ voting_coin_balance: current + toAdd })
      .eq("user_id", v.user_id);
    await admin.from("payout_history").insert({
      poll_id: pollId,
      user_id: v.user_id,
      market: pollRow.market ?? market,
      bet_amount: bet,
      payout_amount: payoutRounded,
    });
  }

  await admin
    .from("sentiment_polls")
    .update({ settled_at: new Date().toISOString() })
    .eq("id", pollId);

  return {
    poll_id: pollId,
    poll_date: pollDate,
    market: pollRow.market ?? market,
    status: "settled",
    participant_count: participantCount,
    winner_side: winnerSide,
    winner_count: winnerVotes.length,
    loser_pool: loserPool,
    payout_total: Math.round(payoutTotal * 100) / 100,
  };
}
