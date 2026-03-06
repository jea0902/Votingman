/**
 * 보팅맨 정산(마감 후 처리) 서비스
 * 명세: docs/votingman-implementation-phases.md 3단계
 *
 * - 무효 판정: 1명 이하 참여 OR 한쪽 쏠림 OR 동일가 → 전원 원금 환불, payout_amount = bet_amount
 * - 정상 승부: 패자 풀을 승자에게 베팅 비율 분배, 승자 잔액 += (원금 + 수령분) × (1 - 1% 수수료)
 * - 패배자: payout_amount = 0, 잔액 변화 없음
 */

import { nowKstString } from "@/lib/kst";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/** 승자 정산 금액(원금+수령분) 전체에 적용하는 수수료 비율 (0~1). 0.01 = 1% */
const PAYOUT_FEE_RATE = 0.01;
import { getBtc1dCandleStartAtUtc } from "@/lib/btc-ohlc/candle-utils";
import {
  getOhlcByMarketAndCandleStart,
  upsertBtcOhlc,
} from "@/lib/btc-ohlc/repository";
import type { SentimentPollRow } from "@/lib/supabase/db-types";
import { fetchCandleByStartAt } from "@/lib/binance/btc-klines";

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
  status: "already_settled" | "invalid_refund" | "settled";
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

  // 무효 판정: 1명 이하 참여 → 원금 환불
  if (participantCount <= 1) {
    for (const v of votes ?? []) {
      if (!v.user_id) continue;
      const refund = Number(v.bet_amount ?? 0);
      if (refund <= 0) continue;
      
      // 잔액에 환불 반영
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

      // payout_history에 무효 기록 (payout_amount = bet_amount, 원금 반환)
      await admin.from("payout_history").insert({
        poll_id: pollId,
        user_id: v.user_id,
        market: pollRow.market ?? market,
        bet_amount: refund,
        payout_amount: refund, // 원금과 동일 (무효)
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
      status: "invalid_refund",
      participant_count: participantCount,
      winner_side: null,
      refunded_user_count: votes?.length ?? 0,
    };
  }

  // 무효 판정: 한쪽 쏠림 (롱만 or 숏만) → 원금 환불
  if (longCoinTotal === 0 || shortCoinTotal === 0) {
    for (const v of votes ?? []) {
      if (!v.user_id) continue;
      const refund = Number(v.bet_amount ?? 0);
      if (refund <= 0) continue;
      
      // 잔액에 환불 반영
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

      // payout_history에 무효 기록 (payout_amount = bet_amount, 원금 반환)
      await admin.from("payout_history").insert({
        poll_id: pollId,
        user_id: v.user_id,
        market: pollRow.market ?? market,
        bet_amount: refund,
        payout_amount: refund, // 원금과 동일 (무효)
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
      status: "invalid_refund",
      participant_count: participantCount,
      winner_side: null,
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

  // 무효 판정: 동일가 (시가 == 종가) → 원금 환불
  if (reference_close === settlement_close) {
    for (const v of votes ?? []) {
      if (!v.user_id) continue;
      const refund = Number(v.bet_amount ?? 0);
      if (refund <= 0) continue;
      
      // 잔액에 환불 반영
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

      // payout_history에 무효 기록 (payout_amount = bet_amount, 원금 반환)
      await admin.from("payout_history").insert({
        poll_id: pollId,
        user_id: v.user_id,
        market: pollRow.market ?? market,
        bet_amount: refund,
        payout_amount: refund, // 원금과 동일 (무효)
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
      status: "invalid_refund",
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
  const loserVotes = (votes ?? []).filter((v) => v.choice !== winnerSide);

  let payoutTotal = 0;
  
  // 승리자 정산 및 기록
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
      payout_amount: payoutRecorded, // 수익 (양수)
    });
  }

  // 패배자 기록 (payout_amount = 0, 잔액 변화 없음)
  for (const v of loserVotes) {
    if (!v.user_id) continue;
    const bet = Number(v.bet_amount ?? 0);
    
    await admin.from("payout_history").insert({
      poll_id: pollId,
      user_id: v.user_id,
      market: pollRow.market ?? market,
      bet_amount: bet,
      payout_amount: 0, // 패배: 아무것도 돌려받지 않음
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

export type InvalidatePollResult = {
  poll_id: string;
  market: string | null;
  status: "invalid_refund" | "already_settled" | "not_found";
  refunded_user_count: number;
  error?: string;
};

/**
 * 관리자 강제 무효 처리: 해당 폴의 모든 투표를 중지하고 원금 환불
 * - Binance API 장애 등으로 정산 불가 시 사용
 * - sentiment_polls: settled_at + long/short 집계 0으로 초기화
 * - sentiment_votes: bet_amount=0으로 초기화 (participant_count, my_vote 표시 제거)
 *   → 전부 초기화로 새 투표지와 동일한 상태
 */
export async function invalidatePollAsAdmin(
  pollId: string
): Promise<InvalidatePollResult> {
  const admin = createSupabaseAdmin();

  const { data: poll, error: pollError } = await admin
    .from("sentiment_polls")
    .select("id, market, settled_at")
    .eq("id", pollId)
    .maybeSingle();

  if (pollError || !poll) {
    return {
      poll_id: pollId,
      market: null,
      status: "not_found",
      refunded_user_count: 0,
      error: pollError?.message ?? "폴을 찾을 수 없습니다.",
    };
  }

  const pollRow = poll as { id: string; market: string | null; settled_at?: string | null };
  const alreadySettled = !!pollRow.settled_at;

  const { data: votes } = await admin
    .from("sentiment_votes")
    .select("user_id, bet_amount")
    .eq("poll_id", pollId)
    .gt("bet_amount", 0)
    .not("user_id", "is", null);

  let refundedCount = 0;
  if (!alreadySettled) {
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

      await admin.from("payout_history").insert({
        poll_id: pollId,
        user_id: v.user_id,
        market: pollRow.market,
        bet_amount: refund,
        payout_amount: refund,
      });
      refundedCount++;
    }
  }

  const pollUpdate: {
    long_coin_total: number;
    short_coin_total: number;
    long_count: number;
    short_count: number;
    settled_at?: string;
  } = {
    long_coin_total: 0,
    short_coin_total: 0,
    long_count: 0,
    short_count: 0,
  };
  if (!alreadySettled) {
    pollUpdate.settled_at = nowKstString();
  }
  await admin.from("sentiment_polls").update(pollUpdate).eq("id", pollId);

  // sentiment_votes: bet_amount=0으로 초기화 → participant_count 0, my_vote 비표시
  await admin
    .from("sentiment_votes")
    .update({ bet_amount: 0 })
    .eq("poll_id", pollId)
    .gt("bet_amount", 0);

  return {
    poll_id: pollId,
    market: pollRow.market,
    status: alreadySettled ? "already_settled" : "invalid_refund",
    refunded_user_count: refundedCount,
  };
}

/** 백필 후 정산 지원 시장 (btc만, Binance OHLC 사용) */
const BACKFILL_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;

export type BackfillAndSettleResult =
  | (SettlementResult & { backfilled?: boolean })
  | {
      poll_id: string;
      poll_date: string;
      market: string | null;
      status: "not_found" | "already_settled" | "unsupported_market";
      participant_count: number;
      winner_side: null;
      error?: string;
    };

/**
 * 관리자 백필 후 정산: btc_ohlc에 데이터가 없으면 Binance에서 수집 후 정산
 * - cron 실패 등으로 정산이 누락된 폴 복구용
 */
export async function backfillAndSettlePoll(
  pollId: string
): Promise<BackfillAndSettleResult> {
  const admin = createSupabaseAdmin();

  const { data: poll, error: pollError } = await admin
    .from("sentiment_polls")
    .select("id, poll_date, market, candle_start_at, settled_at")
    .eq("id", pollId)
    .maybeSingle();

  if (pollError || !poll) {
    return {
      poll_id: pollId,
      poll_date: "",
      market: null,
      status: "not_found",
      participant_count: 0,
      winner_side: null,
      error: pollError?.message ?? "폴을 찾을 수 없습니다.",
    };
  }

  const pollRow = poll as {
    id: string;
    poll_date: string;
    market: string | null;
    candle_start_at: string;
    settled_at?: string | null;
  };

  if (pollRow.settled_at) {
    return {
      poll_id: pollId,
      poll_date: pollRow.poll_date,
      market: pollRow.market,
      status: "already_settled",
      participant_count: 0,
      winner_side: null,
    };
  }

  const market = pollRow.market ?? "";
  if (!BACKFILL_MARKETS.includes(market as (typeof BACKFILL_MARKETS)[number])) {
    return {
      poll_id: pollId,
      poll_date: pollRow.poll_date,
      market: pollRow.market,
      status: "unsupported_market",
      participant_count: 0,
      winner_side: null,
      error: `백필 지원: btc_1d, btc_4h, btc_1h, btc_15m만 가능. (${market})`,
    };
  }

  const candleStartAt = pollRow.candle_start_at;
  if (!candleStartAt) {
    return {
      poll_id: pollId,
      poll_date: pollRow.poll_date,
      market: pollRow.market,
      status: "not_found",
      participant_count: 0,
      winner_side: null,
      error: "candle_start_at이 없습니다.",
    };
  }

  // btc_ohlc에 없으면 Binance에서 수집
  const existing = await getOhlcByMarketAndCandleStart(market, candleStartAt);
  let backfilled = false;
  if (!existing) {
    const row = await fetchCandleByStartAt(market, candleStartAt);
    if (!row) {
      return {
        poll_id: pollId,
        poll_date: pollRow.poll_date,
        market: pollRow.market,
        status: "already_settled",
        participant_count: 0,
        winner_side: null,
        error: "Binance API에서 해당 캔들을 조회할 수 없습니다.",
      };
    }
    await upsertBtcOhlc(row);
    backfilled = true;
  }

  const settleResult = await settlePoll(
    pollRow.poll_date,
    market,
    candleStartAt
  );

  return {
    ...settleResult,
    backfilled,
  };
}
