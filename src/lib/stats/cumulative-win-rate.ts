/**
 * 전적 및 승률 조회(vote-history)와 동일한 로직으로 누적 승률 계산
 * - sentiment_votes + sentiment_polls(정산됨) + payout_history 기준
 * - payout_amount > 0: 승리, payout_amount = 0: 환불/무효, 기록 없음: 패배
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";

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

  // payout_history 조회
  const { data: payouts } = await admin
    .from("payout_history")
    .select("user_id, poll_id, payout_amount")
    .in("user_id", userIds)
    .in("poll_id", pollIds);

  // userId -> pollId -> payout_amount 맵핑
  const payoutMap = new Map<string, Map<string, number>>();
  for (const payout of payouts ?? []) {
    if (!payout.user_id) continue;
    
    let userPayouts = payoutMap.get(payout.user_id);
    if (!userPayouts) {
      userPayouts = new Map();
      payoutMap.set(payout.user_id, userPayouts);
    }
    userPayouts.set(payout.poll_id, Number(payout.payout_amount ?? 0));
  }

  type VoteRow = (typeof votes)[0];
  type PollRow = (typeof polls)[0];

  const byUser = new Map<string, Array<{ vote: VoteRow; poll: PollRow; payout_amount: number }>>();

  for (const vote of votes) {
    const poll = pollMap.get(vote.poll_id);
    if (!poll?.poll_date) continue;

    const userPayouts = payoutMap.get(vote.user_id);
    const payout_amount = userPayouts?.get(vote.poll_id) ?? -1; // -1 = 기록 없음 (패배)

    let arr = byUser.get(vote.user_id);
    if (!arr) {
      arr = [];
      byUser.set(vote.user_id, arr);
    }
    arr.push({ vote, poll, payout_amount });
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

    for (const { vote, poll, payout_amount } of arr) {
      // payout_history 기준 승부 판정 (정산 결과와 일치)
      let resultType: "win" | "loss" | "invalid" = "invalid";
      
      if (payout_amount >= 0) {
        // payout_history에 기록이 있는 경우
        const bet = Number(vote.bet_amount ?? 0);
        if (payout_amount > bet) {
          resultType = "win";       // payout > bet_amount = 승리 (수익)
        } else if (payout_amount === bet) {
          resultType = "invalid";   // payout = bet_amount = 무효 (원금 반환)
        } else {
          resultType = "loss";      // payout < bet_amount = 패배 (손실)
        }
      } else {
        // payout_history에 기록이 없는 경우도 무효 처리 (과거 데이터 호환성)
        resultType = "invalid";
      }

      if (resultType === "win") wins++;
      if (resultType === "win" || resultType === "loss") totalCounted++;
    }

    const pct = totalCounted > 0 ? Math.round((wins / totalCounted) * 1000) / 10 : 0;
    result.set(userId, pct);
  }

  return result;
}
