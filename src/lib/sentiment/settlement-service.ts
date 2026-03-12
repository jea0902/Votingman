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
import {
  getBtc1dCandleStartAtUtc,
  normalizeBtc4hCandleStartAt,
  toCanonicalCandleStartAt,
} from "@/lib/btc-ohlc/candle-utils";
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
  /** 일부 승자 VTC 지급 실패 시 해당 user_id 목록 (정산은 완료, 수동 보정 필요) */
  failed_user_ids?: string[];
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

const COIN_MARKETS_SETTLE = [
  "btc_1d",
  "btc_4h",
  "btc_1h",
  "btc_15m",
  "btc_5m",
  "eth_1d",
  "eth_4h",
  "eth_1h",
  "eth_15m",
  "eth_5m",
  "usdt_1d",
  "usdt_4h",
  "usdt_1h",
  "usdt_15m",
  "usdt_5m",
  "xrp_1d",
  "xrp_4h",
  "xrp_1h",
  "xrp_15m",
  "xrp_5m",
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

const RPC_BATCH_SIZE = 50;

/** 구간별 시간 측정용 (ms). 로그에서 [settlement] timing 으로 검색 */
function logTiming(label: string, startMs: number, extra?: Record<string, unknown>) {
  const ms = Math.round(performance.now() - startMs);
  console.error("[settlement] timing", { phase: label, ms, ...extra });
}

/** 청크 단위로 병렬 실행 (bulk 실패 시 fallback) */
async function runInChunks<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    results.push(...(await Promise.all(chunk.map(fn))));
  }
  return results;
}

/**
 * 무효 시 전원 원금 환불: payout_history 배치 insert → add_voting_coin_bulk 1회
 */
async function invalidRefundAll(
  admin: ReturnType<typeof createSupabaseAdmin>,
  pollId: string,
  market: string,
  votes: Array<{ user_id: string | null; bet_amount: unknown }>
): Promise<number> {
  const refunds = (votes ?? [])
    .filter((v): v is { user_id: string; bet_amount: unknown } => !!v.user_id)
    .map((v) => ({ user_id: v.user_id!, refund: Number(v.bet_amount ?? 0) }))
    .filter((r) => r.refund > 0);
  if (refunds.length === 0) return 0;

  const payoutRows = refunds.map((r) => ({
    poll_id: pollId,
    user_id: r.user_id,
    market,
    bet_amount: r.refund,
    payout_amount: r.refund,
  }));
  const invStart = performance.now();
  await admin.from("payout_history").insert(payoutRows);
  logTiming("invalid_payout_insert", invStart, { poll_id: pollId, rows: payoutRows.length });

  const bulkItems = refunds.map((r) => ({
    user_id: r.user_id,
    amount: r.refund,
  }));
  const bulkStart = performance.now();
  const { data: updatedIds, error } = await admin.rpc("add_voting_coin_bulk", {
    p_items: bulkItems,
  });
  logTiming("invalid_add_voting_coin_bulk", bulkStart, {
    poll_id: pollId,
    success: (updatedIds ?? []).length,
    error: !!error,
  });
  if (error) {
    console.error("[settlement] add_voting_coin_bulk failed, fallback to individual", {
      poll_id: pollId,
      error: (error as { message?: string })?.message,
    });
    let refunded = 0;
    for (const r of refunds) {
      const { data, error: e } = await admin.rpc("add_voting_coin", {
        p_user_id: r.user_id,
        p_amount: r.refund,
      });
      if (!e && data != null) refunded++;
    }
    return refunded;
  }
  return (updatedIds ?? []).length;
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

  if (!COIN_MARKETS_SETTLE.includes(market as (typeof COIN_MARKETS_SETTLE)[number])) {
    return {
      poll_id: "",
      poll_date: pollDateForResponse,
      market,
      status: "already_settled",
      participant_count: 0,
      winner_side: null,
      error: "지원 market: btc/eth/usdt/xrp 1d,4h,1h,15m,5m",
    };
  }

  // candle_start_at 표준 형식 통일 (크론 형식과 동일)
  const candleStartAtNorm =
    candleStartAt && candleStartAt.trim()
      ? toCanonicalCandleStartAt(candleStartAt)
      : candleStartAt;

  const lookupKey = candleStartAtNorm;
  const ohlcKey = candleStartAtNorm;

  const totalStart = performance.now();
  let phaseStart = performance.now();

  const [pollResult, ohlcPrices] = await Promise.all([
    admin
      .from("sentiment_polls")
      .select("*")
      .eq("market", market)
      .eq("candle_start_at", lookupKey)
      .maybeSingle(),
    getSettlementPricesFromOhlc(market, ohlcKey),
  ]);

  logTiming("1_poll_and_ohlc", phaseStart, { market });

  const poll = pollResult.data;
  const pollError = pollResult.error;

  if (pollError || !poll) {
    const errMsg = pollError?.message ?? "폴을 찾을 수 없습니다.";
    console.error("[settlement] poll not found", {
      market,
      candleStartAt: candleStartAtNorm,
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

  const reference_close = ohlcPrices?.reference_close ?? null;
  const settlement_close = ohlcPrices?.settlement_close ?? null;

  phaseStart = performance.now();
  const [votesRes, existingPayoutsRes] = await Promise.all([
    admin
      .from("sentiment_votes")
      .select("user_id, choice, bet_amount")
      .eq("poll_id", pollId)
      .gt("bet_amount", 0)
      .not("user_id", "is", null),
    admin.from("payout_history").select("user_id").eq("poll_id", pollId),
  ]);
  logTiming("2_votes_and_existing_payouts", phaseStart, { poll_id: pollId });
  const votes = votesRes.data ?? [];
  const alreadyPaidUserIds = new Set(
    (existingPayoutsRes.data ?? []).map((p) => p.user_id as string).filter(Boolean)
  );

  const participantIds = [...new Set(votes.map((v) => v.user_id as string))];
  const participantCount = participantIds.length;

  const choiceNorm = (c: unknown) => String(c ?? "").toLowerCase().trim();
  const longCoinTotal = votes
    .filter((v) => choiceNorm(v.choice) === "long")
    .reduce((sum, v) => sum + Number(v.bet_amount ?? 0), 0);
  const shortCoinTotal = votes
    .filter((v) => choiceNorm(v.choice) === "short")
    .reduce((sum, v) => sum + Number(v.bet_amount ?? 0), 0);

  // 무효 판정: 1명 이하 참여 → 원금 환불 (payout_history 먼저 insert, 환불 실패해도 전원 기록)
  if (participantCount <= 1) {
    phaseStart = performance.now();
    console.error("[settlement] 무효: 1명 이하 참여", {
      poll_id: pollId,
      market: pollRow.market ?? market,
      participant_count: participantCount,
      votes: (votes ?? []).map((v) => ({ user_id: v.user_id, choice: v.choice, bet_amount: v.bet_amount })),
    });
    const refunded = await invalidRefundAll(
      admin,
      pollId,
      pollRow.market ?? market,
      votes ?? []
    );
    logTiming("3a_invalidRefundAll", phaseStart, { poll_id: pollId, refunded });
    phaseStart = performance.now();
    await admin
      .from("sentiment_polls")
      .update({ settled_at: nowKstString() })
      .eq("id", pollId);
    logTiming("3b_poll_settled_at", phaseStart, { poll_id: pollId });
    logTiming("TOTAL_invalid_1person", totalStart, { poll_id: pollId });
    return {
      poll_id: pollId,
      poll_date: pollDateForResponse,
      market: pollRow.market ?? market,
      status: "invalid_refund",
      participant_count: participantCount,
      winner_side: null,
      refunded_user_count: refunded,
    };
  }

  // 무효 판정: 한쪽 쏠림 (롱만 or 숏만) → 원금 환불
  if (longCoinTotal === 0 || shortCoinTotal === 0) {
    phaseStart = performance.now();
    console.error("[settlement] 무효: 한쪽 쏠림", {
      poll_id: pollId,
      market: pollRow.market ?? market,
      longCoinTotal,
      shortCoinTotal,
      choices: (votes ?? []).map((v) => v.choice),
    });
    const refunded = await invalidRefundAll(
      admin,
      pollId,
      pollRow.market ?? market,
      votes ?? []
    );
    logTiming("3a_invalidRefundAll", phaseStart, { poll_id: pollId, refunded });
    phaseStart = performance.now();
    await admin
      .from("sentiment_polls")
      .update({ settled_at: nowKstString() })
      .eq("id", pollId);
    logTiming("3b_poll_settled_at", phaseStart, { poll_id: pollId });
    logTiming("TOTAL_invalid_skew", totalStart, { poll_id: pollId });
    return {
      poll_id: pollId,
      poll_date: pollDateForResponse,
      market: pollRow.market ?? market,
      status: "invalid_refund",
      participant_count: participantCount,
      winner_side: null,
      refunded_user_count: refunded,
    };
  }

  if (reference_close == null || settlement_close == null) {
    console.error("[settlement] btc_ohlc row missing (OHLC 조회 실패)", {
      poll_id: pollId,
      market: pollRow.market ?? market,
      ohlc_key: ohlcKey,
      candleStartAt,
      participant_count: participantCount,
      long_coin_total: longCoinTotal,
      short_coin_total: shortCoinTotal,
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

  // 동일가: 시가·종가가 소수점 넷째자리까지 완전히 같을 때만 무효 (둘째자리는 변동 0.01% 이하도 동일가로 잘못 판정됨)
  const refRounded = Math.round(reference_close * 10000) / 10000;
  const settleRounded = Math.round(settlement_close * 10000) / 10000;
  const isTie = refRounded === settleRounded;

  // 정산 시점 가격 로그 (동일가/승패 원인 검증용)
  console.error("[settlement] OHLC 가격 (cron 정산)", {
    poll_id: pollId,
    market: pollRow.market ?? market,
    ohlc_key: ohlcKey,
    reference_close,
    settlement_close,
    refRounded,
    settleRounded,
    isTie,
    participant_count: participantCount,
    long_coin_total: longCoinTotal,
    short_coin_total: shortCoinTotal,
  });

  if (isTie) {
    phaseStart = performance.now();
    console.error("[settlement] 동일가 무효 (소수점 넷째자리 동일)", {
      poll_id: pollId,
      market: pollRow.market ?? market,
      ohlc_key: ohlcKey,
      reference_close,
      settlement_close,
      refRounded,
      settleRounded,
    });
    const refunded = await invalidRefundAll(
      admin,
      pollId,
      pollRow.market ?? market,
      votes ?? []
    );
    logTiming("3a_invalidRefundAll", phaseStart, { poll_id: pollId, refunded });
    phaseStart = performance.now();
    await admin
      .from("sentiment_polls")
      .update({ settled_at: nowKstString() })
      .eq("id", pollId);
    logTiming("3b_poll_settled_at", phaseStart, { poll_id: pollId });
    logTiming("TOTAL_invalid_tie", totalStart, { poll_id: pollId });
    return {
      poll_id: pollId,
      poll_date: pollDateForResponse,
      market: pollRow.market ?? market,
      status: "invalid_refund",
      participant_count: participantCount,
      winner_side: null,
      refunded_user_count: refunded,
    };
  }

  const winnerSide: "long" | "short" =
    settlement_close > reference_close ? "long" : "short";
  const winnerVotes = (votes ?? []).filter((v) => choiceNorm(v.choice) === winnerSide);
  const loserVotes = (votes ?? []).filter((v) => choiceNorm(v.choice) !== winnerSide);

  console.error("[settlement] 승/패 판정 (choice 매칭 결과)", {
    poll_id: pollId,
    market: pollRow.market ?? market,
    reference_close,
    settlement_close,
    refRounded,
    settleRounded,
    diff: settlement_close - reference_close,
    winner_side: winnerSide,
    winner_count: winnerVotes.length,
    loser_count: loserVotes.length,
    votes_detail: (votes ?? []).map((v) => ({
      user_id: v.user_id,
      choice_raw: v.choice,
      choice_norm: choiceNorm(v.choice),
      matches_winner: choiceNorm(v.choice) === winnerSide,
      bet_amount: v.bet_amount,
    })),
  });

  // 폴 캐시(long_coin_total 등) 대신 실제 votes에서 집계 (동시성·누락 방지)
  const winnerTotalBet = winnerVotes.reduce(
    (sum, v) => sum + Number(v.bet_amount ?? 0),
    0
  );
  const loserPool = loserVotes.reduce(
    (sum, v) => sum + Number(v.bet_amount ?? 0),
    0
  );

  let payoutTotal = 0;
  const failed_user_ids: string[] = [];

  /**
   * 승리자 VTC 지급: RPC add_voting_coin으로 원자적 증가만 수행.
   * 병렬 실행으로 정산 속도 개선 (여러 승자 시 순차 대비 단축).
   */
  const winnerPayouts = winnerVotes
    .filter((v) => v.user_id && !alreadyPaidUserIds.has(v.user_id))
    .map((v) => {
      const bet = Number(v.bet_amount ?? 0);
      const payoutGross =
        winnerTotalBet > 0 ? (loserPool * bet) / winnerTotalBet : 0;
      const totalGross = bet + payoutGross;
      const totalAfterFee =
        Math.round(totalGross * (1 - PAYOUT_FEE_RATE) * 100) / 100;
      const payoutRecorded = totalAfterFee - bet;
      return { v, bet, totalAfterFee, payoutRecorded };
    });

  const marketStr = pollRow.market ?? market;

  // ① ensure_users: public.users에 없는 유저 생성
  phaseStart = performance.now();
  const winnerUserIds = winnerPayouts.map((p) => p.v.user_id!);
  await admin.rpc("ensure_users_for_settlement_bulk", {
    p_user_ids: winnerUserIds,
  });
  logTiming("4_ensure_users_bulk", phaseStart, { poll_id: pollId, count: winnerUserIds.length });

  // ② add_voting_coin_bulk: 1회 RPC로 전원 지급
  phaseStart = performance.now();
  const bulkItems = winnerPayouts.map((p) => ({
    user_id: p.v.user_id!,
    amount: p.totalAfterFee,
  }));
  const { data: bulkUpdated, error: bulkErr } = await admin.rpc("add_voting_coin_bulk", {
    p_items: bulkItems,
  });
  const successUserIds = new Set(
    (bulkUpdated ?? []).map((r: { updated_user_id?: string }) => r?.updated_user_id).filter(Boolean)
  );
  logTiming("5_add_voting_coin_bulk", phaseStart, {
    poll_id: pollId,
    success: successUserIds.size,
    total: winnerPayouts.length,
    bulk_err: !!bulkErr,
  });

  if (bulkErr || successUserIds.size < winnerPayouts.length) {
    // ③ bulk 실패 또는 일부 미지급 → 개별 재시도
    for (const p of winnerPayouts) {
      if (successUserIds.has(p.v.user_id!)) continue;
      let { data: updatedId, error: rpcErr } = await admin.rpc("add_voting_coin", {
        p_user_id: p.v.user_id!,
        p_amount: p.totalAfterFee,
      });
      if (rpcErr || updatedId == null) {
        const ensured =
          (await admin.rpc("ensure_user_for_settlement", { p_user_id: p.v.user_id! })).data === true;
        if (ensured) {
          const retry = await admin.rpc("add_voting_coin", {
            p_user_id: p.v.user_id!,
            p_amount: p.totalAfterFee,
          });
          if (retry.data != null && !retry.error) successUserIds.add(p.v.user_id!);
        }
      } else {
        successUserIds.add(p.v.user_id!);
      }
      if (!successUserIds.has(p.v.user_id!)) {
        failed_user_ids.push(p.v.user_id!);
      }
    }
  }

  payoutTotal = winnerPayouts
    .filter((p) => successUserIds.has(p.v.user_id!))
    .reduce((s, p) => s + p.payoutRecorded, 0);

  const winnerPayoutRows = winnerPayouts.map((p) => ({
    poll_id: pollId,
    user_id: p.v.user_id,
    market: marketStr,
    bet_amount: p.bet,
    payout_amount: p.payoutRecorded,
  }));
  const loserPayoutRows = loserVotes
    .filter((v) => v.user_id && !alreadyPaidUserIds.has(v.user_id))
    .map((v) => ({
      poll_id: pollId,
      user_id: v.user_id!,
      market: pollRow.market ?? market,
      bet_amount: Number(v.bet_amount ?? 0),
      payout_amount: 0,
    }));
  const allPayoutRows = [...winnerPayoutRows, ...loserPayoutRows];
  phaseStart = performance.now();
  if (allPayoutRows.length > 0) {
    await admin.from("payout_history").insert(allPayoutRows);
  }
  logTiming("6_payout_history_insert", phaseStart, {
    poll_id: pollId,
    rows: allPayoutRows.length,
  });

  // 승패 판정 최종 결과 로그 (payout_history 기록 완료)
  const payoutSummary = [
    ...winnerVotes.map((v) => ({
      user_id: v.user_id,
      choice: v.choice,
      result: "win" as const,
      bet: Number(v.bet_amount ?? 0),
      payout: "수익",
    })),
    ...loserVotes.map((v) => ({
      user_id: v.user_id,
      choice: v.choice,
      result: "loss" as const,
      bet: Number(v.bet_amount ?? 0),
      payout: 0,
    })),
  ];
  console.error("[settlement] payout 기록 완료", {
    poll_id: pollId,
    market: pollRow.market ?? market,
    winner_side: winnerSide,
    payout_summary: payoutSummary,
  });

  phaseStart = performance.now();
  await admin
    .from("sentiment_polls")
    .update({ settled_at: nowKstString() })
    .eq("id", pollId);
  logTiming("7_poll_settled_at", phaseStart, { poll_id: pollId });
  logTiming("TOTAL_settled", totalStart, {
    poll_id: pollId,
    winner_count: winnerVotes.length,
    loser_count: loserVotes.length,
  });

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
    ...(failed_user_ids.length > 0 && { failed_user_ids }),
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

      const { data: u, error: selectErr } = await admin
        .from("users")
        .select("voting_coin_balance")
        .eq("user_id", v.user_id)
        .maybeSingle();
      if (selectErr || u == null) {
        console.error("[invalidatePoll] User not found for refund", {
          poll_id: pollId,
          user_id: v.user_id,
          error: selectErr?.message,
        });
        throw new Error(`환불 대상(user_id=${v.user_id})가 users 테이블에 없습니다.`);
      }

      const current = Number(u.voting_coin_balance ?? 0);
      const { data: updated, error: updateErr } = await admin
        .from("users")
        .update({ voting_coin_balance: current + refund })
        .eq("user_id", v.user_id)
        .select("user_id");
      if (updateErr || !updated || updated.length === 0) {
        console.error("[invalidatePoll] Failed to refund", {
          poll_id: pollId,
          user_id: v.user_id,
          refund,
          error: updateErr?.message,
        });
        throw new Error(`환불(user_id=${v.user_id}) 반영 실패.`);
      }

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

/** 백필 후 정산 지원 시장 (코인, Binance OHLC 사용) */
const BACKFILL_MARKETS = [
  "btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m",
  "eth_1d", "eth_4h", "eth_1h", "eth_15m", "eth_5m",
  "usdt_1d", "usdt_4h", "usdt_1h", "usdt_15m", "usdt_5m",
  "xrp_1d", "xrp_4h", "xrp_1h", "xrp_15m", "xrp_5m",
] as const;

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
      error: `백필 지원: btc/eth/usdt/xrp 1d,4h,1h,15m,5m만 가능. (${market})`,
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

  // 1d: Binance는 00:00 UTC만 있음. 4h: Binance는 00/04/08/12/16/20 UTC만 있음.
  const ohlcLookupKey =
    market === "btc_1d" || market === "eth_1d" || market === "usdt_1d" || market === "xrp_1d"
      ? getBtc1dCandleStartAtUtc(candleStartAt.slice(0, 10))
      : market === "btc_4h" || market === "eth_4h" || market === "usdt_4h" || market === "xrp_4h"
        ? normalizeBtc4hCandleStartAt(candleStartAt)
        : candleStartAt;

  // btc_ohlc에 없으면 Binance에서 수집 (호출 전 정규화)
  const ohlcKey = toCanonicalCandleStartAt(candleStartAt);
  const existing = await getOhlcByMarketAndCandleStart(market, ohlcKey);
  let backfilled = false;
  if (!existing) {
    const row = await fetchCandleByStartAt(market, ohlcLookupKey);
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
