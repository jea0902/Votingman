/**
 * GET /api/profile/vote-history
 * 로그인 사용자의 정산 완료 투표 이력 조회
 *
 * 쿼리: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD (예측 대상일 기준 필터)
 * 예측 대상일, 정산 날짜, market, 배팅 코인 수, 시가, 종가, 가격변동률,
 * 승리 여부, payout_amount, 누적 승률 포함 (총 보유 코인 수는 클라이언트에서 계산)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOhlcByMarketAndCandleStart } from "@/lib/btc-ohlc/repository";
import { MARKET_LABEL } from "@/lib/constants/sentiment-markets";

const BTC_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;

export type VoteHistoryRow = {
  /** 예측 대상일 (poll_date) */
  poll_date: string;
  /** 정산 완료 시각 */
  settled_at: string;
  market: string;
  market_label: string;
  bet_amount: number;
  price_open: number | null;
  price_close: number | null;
  change_pct: number | null;
  /** 승 | 패 | 무효(환불) */
  result: "win" | "loss" | "refund";
  payout_amount: number;
  /** 해당 행까지의 누적 승률 (0~100, 승패만 카운트) */
  cumulative_win_rate_pct: number;
  /** 정산 후 누적 보유 코인 (해당 행 정산 직후 기준) */
  balance_after: number;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        },
        { status: 401 }
      );
    }

    const admin = createSupabaseAdmin();

    // sentiment_votes + sentiment_polls + payout_history
    const { data: votes, error: votesError } = await admin
      .from("sentiment_votes")
      .select("id, poll_id, choice, bet_amount, market")
      .eq("user_id", user.id)
      .gt("bet_amount", 0);

    if (votesError || !votes?.length) {
      return NextResponse.json({
        success: true,
        data: { rows: [], current_balance: 0 },
      });
    }

    const pollIds = [...new Set(votes.map((v) => v.poll_id))];

    let pollsQuery = admin
      .from("sentiment_polls")
      .select("id, poll_date, market, candle_start_at, settled_at")
      .in("id", pollIds)
      .not("settled_at", "is", null);

    if (startDate && DATE_REGEX.test(startDate)) {
      pollsQuery = pollsQuery.gte("poll_date", startDate);
    }
    if (endDate && DATE_REGEX.test(endDate)) {
      pollsQuery = pollsQuery.lte("poll_date", endDate);
    }

    const { data: polls, error: pollsError } = await pollsQuery;

    if (pollsError || !polls?.length) {
      return NextResponse.json({
        success: true,
        data: { rows: [], current_balance: 0 },
      });
    }

    const pollMap = new Map(polls.map((p) => [p.id, p]));

    const { data: payouts } = await admin
      .from("payout_history")
      .select("poll_id, payout_amount")
      .eq("user_id", user.id)
      .in("poll_id", pollIds);

    const payoutByPollId = new Map(
      (payouts ?? []).map((p) => [p.poll_id, Number(p.payout_amount ?? 0)])
    );

    // vote -> poll 조인, 정산된 폴만
    const joined: Array<{
      vote: (typeof votes)[0];
      poll: (typeof polls)[0];
      payout_amount: number;
    }> = [];

    for (const vote of votes) {
      const poll = pollMap.get(vote.poll_id);
      if (!poll?.settled_at) continue;

      const payout_amount = payoutByPollId.get(vote.poll_id) ?? 0;
      joined.push({ vote, poll, payout_amount });
    }

    // 예측 대상일 오름차순 (오래된 것 먼저) → 누적 승률 계산용
    joined.sort(
      (a, b) =>
        a.poll.poll_date.localeCompare(b.poll.poll_date) ||
        (a.poll.market ?? "").localeCompare(b.poll.market ?? "")
    );

    const rows: VoteHistoryRow[] = [];
    let wins = 0;
    let totalCounted = 0;

    // 1차: 결과·누적승률 계산 및 net 변동 수집
    const nets: number[] = [];
    for (const { vote, poll, payout_amount } of joined) {
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

      let result: "win" | "loss" | "refund" = "refund";
      if (open == null || close == null) {
        result = "refund";
      } else if (open === close) {
        result = "refund";
      } else {
        const isLong = vote.choice === "long";
        const priceUp = close > open;
        result = isLong === priceUp ? "win" : "loss";
      }

      const bet = Number(vote.bet_amount ?? 0);
      const net = result === "win" ? payout_amount : result === "loss" ? -bet : 0;
      nets.push(net);

      // 표시용 payout: 승리 시 실제 지급액, 패배 시 -배팅 코인 수, 무효 시 0
      const displayPayout = result === "win" ? payout_amount : result === "loss" ? -bet : 0;

      if (result === "win") wins++;
      if (result === "win" || result === "loss") totalCounted++;

      const cumulative_win_rate_pct =
        totalCounted > 0 ? Math.round((wins / totalCounted) * 1000) / 10 : 0;

      rows.push({
        poll_date: poll.poll_date,
        settled_at: poll.settled_at,
        market: poll.market ?? vote.market ?? "—",
        market_label: MARKET_LABEL[poll.market as keyof typeof MARKET_LABEL] ?? poll.market ?? "—",
        bet_amount: bet,
        price_open: open,
        price_close: close,
        change_pct:
          open != null && close != null && open > 0
            ? Math.round((close - open) / open * 10000) / 10000
            : null,
        result,
        payout_amount: displayPayout,
        cumulative_win_rate_pct,
        balance_after: 0,
      });
    }

    const totalNet = nets.reduce((a, b) => a + b, 0);
    const { data: profileForBalance } = await admin
      .from("users")
      .select("voting_coin_balance")
      .eq("user_id", user.id)
      .maybeSingle();
    const currentBalanceVal = profileForBalance?.voting_coin_balance != null
      ? Number(profileForBalance.voting_coin_balance)
      : 0;
    const balanceBeforeFirst = currentBalanceVal - totalNet;

    let runningBalance = balanceBeforeFirst;
    for (let i = 0; i < rows.length; i++) {
      runningBalance += nets[i];
      rows[i].balance_after = Math.round(runningBalance * 100) / 100;
    }

    // 표시용: 최신이 위로 (예측 대상일 내림차순)
    rows.reverse();

    const current_balance = currentBalanceVal;

    return NextResponse.json({
      success: true,
      data: { rows, current_balance },
    });
  } catch (error) {
    console.error("[profile/vote-history] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "투표 이력을 불러오는데 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
