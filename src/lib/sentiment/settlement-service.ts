/**
 * 보팅맨 정산(마감 후 처리) 서비스
 * 명세: docs/votingman-implementation-phases.md 3단계
 *
 * - 단독 참여(무효판): 참여 1명 이하 → 전액 환불, payout_history 없음
 * - 한쪽 쏠림: 롱만 or 숏만 → 전원 원금 환불, payout_history 당첨자만 payout_amount=0
 * - 정상: 패자 풀을 승자에게 베팅 비율 분배, 당첨자 잔액 += (원금 + 수령분) × (1 - 1% 수수료)
 */

import { nowKstString } from "@/lib/kst";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/** 승자 정산 금액(원금+수령분) 전체에 적용하는 수수료 비율 (0~1). 0.01 = 1% */
const PAYOUT_FEE_RATE = 0.01;
import { getBtc1dCandleStartAtUtc } from "@/lib/btc-ohlc/candle-utils";
import { getOhlcByMarketAndCandleStart } from "@/lib/btc-ohlc/repository";
import type { SentimentPollRow } from "@/lib/supabase/db-types";

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** btc_ohlc에서 종가끼리 비교 정산용 가격 조회 (reference_close vs settlement_close) */
export async function getSettlementPricesFromOhlc(
  market: string,
  candleStartAt: string
): Promise<{ reference_close: number; settlement_close: number } | null> {
  const row = await getOhlcByMarketAndCandleStart(market, candleStartAt);
  if (!row) return null;
  return {
    reference_close: row.reference_close,
    settlement_close: row.settlement_close,
  };
}

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
 * @deprecated sentiment_polls에 price_open/close가 제거됨. btc_ohlc에서 조회 사용.
 */
export async function updateBtcOhlcForPoll(
  _pollDate: string,
  _pollId: string
): Promise<{ price_open: number | null; price_close: number | null }> {
  return { price_open: null, price_close: null };
}

const BTC_MARKETS_SETTLE = [
  "btc_1d",
  "btc_4h",
  "btc_1h",
  "btc_15m",
  "btc_1W",
  "btc_1M",
  "btc_12M",
] as const;

/** candle_start_at(UTC ISO) → poll_date YYYY-MM-DD (KST) */
function candleStartAtToPollDateKst(candleStartAt: string): string {
  const d = new Date(candleStartAt);
  const kstMs = d.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 단일 폴 정산 실행
 * - poll_date: YYYY-MM-DD (KST). btc_1d일 때만 필수(또는 candle_start_at으로 대체).
 * - market: btc_1d, btc_4h, btc_1h, btc_15m, btc_1W, btc_1M, btc_12M
 * - candle_start_at: 4h/1h/15m일 때 필수. btc_1d일 때 생략 시 poll_date로 유도.
 * - 정산: btc_ohlc에서 종가끼리 비교 (reference_close vs settlement_close)
 */
export async function settlePoll(
  pollDate: string,
  market: string,
  candleStartAtParam?: string
): Promise<SettlementResult> {
  const admin = createSupabaseAdmin();

  const candleStartAt: string | null =
    candleStartAtParam ??
    (market === "btc_1d" && POLL_DATE_REGEX.test(pollDate)
      ? getBtc1dCandleStartAtUtc(pollDate)
      : null);

  if (!candleStartAt) {
    return {
      poll_id: "",
      poll_date: pollDate,
      market,
      status: "already_settled",
      participant_count: 0,
      winner_side: null,
      error:
        market === "btc_1d"
          ? "poll_date must be YYYY-MM-DD"
          : `${market} 정산 시 candle_start_at(ISO)을 넘겨주세요.`,
    };
  }

  const pollDateForResponse = POLL_DATE_REGEX.test(pollDate)
    ? pollDate
    : candleStartAtToPollDateKst(candleStartAt);

  if (!BTC_MARKETS_SETTLE.includes(market as (typeof BTC_MARKETS_SETTLE)[number])) {
    return {
      poll_id: "",
      poll_date: pollDateForResponse,
      market,
      status: "already_settled",
      participant_count: 0,
      winner_side: null,
      error: "지원 market: btc_1d, btc_4h, btc_1h, btc_15m, btc_1W, btc_1M, btc_12M",
    };
  }

  const { data: poll, error: pollError } = await admin
    .from("sentiment_polls")
    .select("*")
    .eq("market", market)
    .eq("candle_start_at", candleStartAt)
    .maybeSingle();

  if (pollError || !poll) {
    const errMsg = pollError?.message ?? "폴을 찾을 수 없습니다.";
    console.error("[settlement] poll not found", {
      market,
      candleStartAt,
      pollDateForResponse,
      error: errMsg,
    });
    return {
      poll_id: "",
      poll_date: pollDateForResponse,
      market,
      status: "already_settled",
      participant_count: 0,
      winner_side: null,
      error: errMsg,
    };
  }

  const pollRow = poll as SentimentPollRow & { settled_at?: string | null };
  const pollId = pollRow.id;

  if (pollRow.settled_at) {
    return {
      poll_id: pollId,
      poll_date: pollDateForResponse,
      market: pollRow.market ?? market,
      status: "already_settled",
      participant_count: 0,
      winner_side: null,
    };
  }

  // btc_ohlc에서 종가끼리 비교용 가격 조회
  const ohlcPrices = await getSettlementPricesFromOhlc(market, candleStartAt);
  const reference_close = ohlcPrices?.reference_close ?? null;
  const settlement_close = ohlcPrices?.settlement_close ?? null;

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
      .update({ settled_at: nowKstString() })
      .eq("id", pollId);
    return {
      poll_id: pollId,
      poll_date: pollDateForResponse,
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
      .update({ settled_at: nowKstString() })
      .eq("id", pollId);
    return {
      poll_id: pollId,
      poll_date: pollDateForResponse,
      market: pollRow.market ?? market,
      status: "one_side_refund",
      participant_count: participantCount,
      winner_side: winnerChoice,
      refunded_user_count: votes?.length ?? 0,
    };
  }

  if (reference_close == null || settlement_close == null) {
    console.error("[settlement] btc_ohlc row missing", {
      poll_id: pollId,
      market: pollRow.market ?? market,
      candleStartAt,
      participant_count: participantCount,
    });
    return {
      poll_id: pollId,
      poll_date: pollDateForResponse,
      market: pollRow.market ?? market,
      status: "already_settled",
      participant_count: participantCount,
      winner_side: null,
      error: "btc_ohlc에 해당 캔들이 없습니다. 크론 수집 후 다시 시도하세요.",
    };
  }

  // reference_close == settlement_close(동일가): 당첨자 없음, 전원 원금 환불
  if (reference_close === settlement_close) {
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
      .update({ settled_at: nowKstString() })
      .eq("id", pollId);
    return {
      poll_id: pollId,
      poll_date: pollDateForResponse,
      market: pollRow.market ?? market,
      status: "draw_refund",
      participant_count: participantCount,
      winner_side: null,
      refunded_user_count: votes?.length ?? 0,
    };
  }

  const winnerSide: "long" | "short" =
    settlement_close > reference_close ? "long" : "short";
  const loserPool = winnerSide === "long" ? shortCoinTotal : longCoinTotal;
  const winnerTotalBet = winnerSide === "long" ? longCoinTotal : shortCoinTotal;
  const winnerVotes = (votes ?? []).filter((v) => v.choice === winnerSide);

  let payoutTotal = 0;
  for (const v of winnerVotes) {
    if (!v.user_id) continue;
    const bet = Number(v.bet_amount ?? 0);
    const payoutGross =
      winnerTotalBet > 0 ? (loserPool * bet) / winnerTotalBet : 0;
    const totalGross = bet + payoutGross;
    const totalAfterFee =
      Math.round(totalGross * (1 - PAYOUT_FEE_RATE) * 100) / 100;
    const payoutRecorded = totalAfterFee - bet;
    payoutTotal += payoutRecorded;
    const { data: u } = await admin
      .from("users")
      .select("voting_coin_balance")
      .eq("user_id", v.user_id)
      .single();
    const current = Number(u?.voting_coin_balance ?? 0);
    await admin
      .from("users")
      .update({ voting_coin_balance: current + totalAfterFee })
      .eq("user_id", v.user_id);
    await admin.from("payout_history").insert({
      poll_id: pollId,
      user_id: v.user_id,
      market: pollRow.market ?? market,
      bet_amount: bet,
      payout_amount: payoutRecorded,
    });
  }

  await admin
    .from("sentiment_polls")
    .update({ settled_at: nowKstString() })
    .eq("id", pollId);

  return {
    poll_id: pollId,
    poll_date: pollDateForResponse,
    market: pollRow.market ?? market,
    status: "settled",
    participant_count: participantCount,
    winner_side: winnerSide,
    winner_count: winnerVotes.length,
    loser_pool: loserPool,
    payout_total: Math.round(payoutTotal * 100) / 100,
  };
}
