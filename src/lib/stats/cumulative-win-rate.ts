/**
 * 전적 및 승률 조회(vote-history)와 동일한 로직으로 누적 승률 계산
 * - sentiment_votes + sentiment_polls(정산됨) + btc_ohlc 기반
 * - 종가끼리 비교 정산 (reference_close vs settlement_close)
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getOhlcByMarketAndCandleStart } from "@/lib/btc-ohlc/repository";

const BTC_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;

/**
 * userIds에 해당하는 유저들의 누적 승률(%)
 * - 해당 유저의 vote-history 맨 위(최신) 날짜 누적 승률과 동일
 */
export async function getCumulativeWinRatesByUserIds(
  userIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (userIds.length === 0) return result;

  const admin = createSupabaseAdmin();

  const { data: votes } = await admin
    .from("sentiment_votes")
    .select("id, user_id, poll_id, choice, bet_amount")
    .in("user_id", userIds)
    .gt("bet_amount", 0);

  if (!votes?.length) {
    userIds.forEach((id) => result.set(id, 0));
    return result;
  }

  const pollIds = [...new Set(votes.map((v) => v.poll_id))];

  const { data: polls } = await admin
    .from("sentiment_polls")
    .select("id, poll_date, market, candle_start_at")
    .in("id", pollIds)
    .not("settled_at", "is", null);

  if (!polls?.length) {
    userIds.forEach((id) => result.set(id, 0));
    return result;
  }

  const pollMap = new Map(polls.map((p) => [p.id, p]));

  type VoteRow = (typeof votes)[0];
  type PollRow = (typeof polls)[0];

  const byUser = new Map<string, Array<{ vote: VoteRow; poll: PollRow }>>();

  for (const vote of votes) {
    const poll = pollMap.get(vote.poll_id);
    if (!poll?.poll_date) continue;

    let arr = byUser.get(vote.user_id);
    if (!arr) {
      arr = [];
      byUser.set(vote.user_id, arr);
    }
    arr.push({ vote, poll });
  }

  for (const userId of userIds) {
    const arr = byUser.get(userId);
    if (!arr?.length) {
      result.set(userId, 0);
      continue;
    }

    arr.sort(
      (a, b) =>
        a.poll.poll_date.localeCompare(b.poll.poll_date) ||
        (a.poll.market ?? "").localeCompare(b.poll.market ?? "")
    );

    let wins = 0;
    let totalCounted = 0;

    for (const { vote, poll } of arr) {
      let open: number | null = null;
      let close: number | null = null;
      const market = poll.market ?? "";
      const candleStartAt =
        "candle_start_at" in poll && typeof poll.candle_start_at === "string"
          ? poll.candle_start_at
          : null;
      if (
        candleStartAt &&
        BTC_MARKETS.includes(market as (typeof BTC_MARKETS)[number])
      ) {
        const ohlc = await getOhlcByMarketAndCandleStart(market, candleStartAt);
        if (ohlc) {
          open = ohlc.open;
          close = ohlc.close;
        }
      }

      let resultType: "win" | "loss" | "refund" = "refund";
      if (open != null && close != null && open !== close) {
        const isLong = vote.choice === "long";
        const priceUp = close > open;
        resultType = isLong === priceUp ? "win" : "loss";
      }

      if (resultType === "win") wins++;
      if (resultType === "win" || resultType === "loss") totalCounted++;
    }

    const pct = totalCounted > 0 ? Math.round((wins / totalCounted) * 1000) / 10 : 0;
    result.set(userId, pct);
  }

  return result;
}
