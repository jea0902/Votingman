/**
 * GET /api/sentiment/polls
 * 오늘(KST) 전체 시장 폴 정보 한 번에 조회
 * - 시장별 순차 호출 제거 → 폴 조회/생성, my_vote, count, OHLC를 병렬로 처리해 첫 응답 시간 단축
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateTodayPollByMarket } from "@/lib/sentiment/poll-server";
import { getPreviousCandleStartAt, toCanonicalCandleStartAt } from "@/lib/btc-ohlc/candle-utils";
import { getOhlcByMarketAndCandleStart } from "@/lib/btc-ohlc/repository";
import { fetchPreviousCandleClose } from "@/lib/binance/btc-klines";
import { isVotingOpenKST } from "@/lib/utils/sentiment-vote";
import { SENTIMENT_MARKETS } from "@/lib/constants/sentiment-markets";

const BTC_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"] as const;

type PollPayload = {
  market: string;
  poll_id: string;
  poll_date: string;
  candle_start_at?: string;
  price_open: number | null;
  price_close: number | null;
  settlement_status: "open" | "closed" | "settling" | "settled";
  long_count: number;
  short_count: number;
  total_count: number;
  participant_count: number;
  long_coin_total: number;
  short_coin_total: number;
  total_coin: number;
  my_vote: { choice: "long" | "short"; bet_amount: number } | null;
};

export async function GET() {
  let step: string = "init";
  try {
    const startedAt = Date.now();
    const timings: Record<string, number> = {};

    step = "create-supabase-clients";
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();
    const admin = createSupabaseAdmin();
    timings["create-supabase-clients"] = Date.now() - startedAt;

    step = "get-or-create-polls";
    // 1) 모든 시장 폴 조회/생성 (순차 8번 → 1번 병렬)
    const pollResults = await Promise.all(
      SENTIMENT_MARKETS.map((market) => getOrCreateTodayPollByMarket(market))
    );
    const polls = pollResults.map((r) => r.poll);
    timings["get-or-create-polls"] = Date.now() - startedAt;

    // 2) my_vote 1회 + 참여자 수 8회를 한 번에 병렬
    const pollIds = polls.map((p) => p.id);
    step = "fetch-my-votes-and-counts";
    const myVotesPromise =
      user?.id
        ? admin
            .from("sentiment_votes")
            .select("poll_id, choice, bet_amount")
            .eq("user_id", user.id)
            .in("poll_id", pollIds)
        : Promise.resolve({
            data: [] as { poll_id: string; choice: string; bet_amount: number }[],
            error: null,
          });

    const voteCountsPromise = admin
      .from("sentiment_votes")
      .select("poll_id", { head: false })
      .in("poll_id", pollIds)
      .gt("bet_amount", 0);

    const payoutCountsPromise = admin
      .from("payout_history")
      .select("poll_id", { head: false })
      .in("poll_id", pollIds);

    const [myVotesRes, voteCountsRes, payoutCountsRes] = await Promise.all([
      myVotesPromise,
      voteCountsPromise,
      payoutCountsPromise,
    ]);
    timings["fetch-my-votes-and-counts"] = Date.now() - startedAt;

    const participantCountByPollId = new Map<string, number>();
    if (voteCountsRes.data?.length) {
      for (const row of voteCountsRes.data as { poll_id: string }[]) {
        const prev = participantCountByPollId.get(row.poll_id) ?? 0;
        participantCountByPollId.set(row.poll_id, prev + 1);
      }
    }

    const payoutCountByPollId = new Map<string, number>();
    if (payoutCountsRes.data?.length) {
      for (const row of payoutCountsRes.data as { poll_id: string }[]) {
        const prev = payoutCountByPollId.get(row.poll_id) ?? 0;
        payoutCountByPollId.set(row.poll_id, prev + 1);
      }
    }

    const myVotesByPollId = new Map<string, { choice: "long" | "short"; bet_amount: number }>();
    if (myVotesRes.data?.length) {
      for (const v of myVotesRes.data) {
        if (Number(v.bet_amount) > 0) {
          myVotesByPollId.set(v.poll_id, {
            choice: v.choice as "long" | "short",
            bet_amount: Number(v.bet_amount),
          });
        }
      }
    }

    // 3) BTC 시장: 목표가(이전 봉 종가) + 현재 봉 종가 병렬
    const btcOhlcPromises = polls
      .filter((p) => BTC_MARKETS.includes((p.market ?? "") as (typeof BTC_MARKETS)[number]))
      .map(async (p) => {
        const market = p.market ?? "";
        const raw =
          "candle_start_at" in p && typeof p.candle_start_at === "string"
            ? p.candle_start_at
            : null;
        if (!raw) return { market, open: null as number | null, close: null as number | null };
        const candleStartAt = toCanonicalCandleStartAt(raw);
        const previousCandleStartAt = getPreviousCandleStartAt(market, candleStartAt);
        const [prevOhlc, currentOhlc] = await Promise.all([
          getOhlcByMarketAndCandleStart(market, previousCandleStartAt),
          getOhlcByMarketAndCandleStart(market, candleStartAt),
        ]);
        let open: number | null = prevOhlc?.close ?? null;
        if (open == null) open = await fetchPreviousCandleClose(market, candleStartAt);
        return { market, open, close: currentOhlc?.close ?? null };
      });
    step = "fetch-btc-ohlc";
    const ohlcResults = await Promise.all(btcOhlcPromises);
    timings["fetch-btc-ohlc"] = Date.now() - startedAt;
    const ohlcByMarket = new Map(
      ohlcResults.map((r) => [r.market, { open: r.open, close: r.close }])
    );

    // 4) 결과 조합
    step = "compose-response";
    const pollsByMarket: Record<string, PollPayload> = {};
    for (let i = 0; i < SENTIMENT_MARKETS.length; i++) {
      const market = SENTIMENT_MARKETS[i];
      const poll = polls[i] as typeof polls[0] & { settled_at?: string | null };
      const participantCount = participantCountByPollId.get(poll.id) ?? 0;
      const payoutCount = payoutCountByPollId.get(poll.id) ?? 0;
      const myVote = myVotesByPollId.get(poll.id) ?? null;
      const ohlc = ohlcByMarket.get(poll.market ?? market) ?? null;

      let settlement_status: "open" | "closed" | "settling" | "settled" = "open";
      if (poll.settled_at) {
        settlement_status = "settled";
      } else if (!isVotingOpenKST(market)) {
        if (ohlc?.close != null) {
          settlement_status = payoutCount > 0 ? "settled" : "settling";
        } else {
          settlement_status = "closed";
        }
      }

      pollsByMarket[market] = {
        market: poll.market ?? market,
        poll_id: poll.id,
        poll_date: poll.poll_date,
        candle_start_at:
          "candle_start_at" in poll && typeof poll.candle_start_at === "string"
            ? poll.candle_start_at
            : undefined,
        price_open: ohlc?.open ?? null,
        price_close: ohlc?.close ?? null,
        settlement_status,
        long_count: poll.long_count ?? 0,
        short_count: poll.short_count ?? 0,
        total_count: (poll.long_count ?? 0) + (poll.short_count ?? 0),
        participant_count: participantCount ?? 0,
        long_coin_total: poll.long_coin_total ?? 0,
        short_coin_total: poll.short_coin_total ?? 0,
        total_coin: (poll.long_coin_total ?? 0) + (poll.short_coin_total ?? 0),
        my_vote: myVote,
      };
    }

    step = "return-success";
    console.info("[sentiment/polls] timings(ms)", timings);
    return NextResponse.json(
      {
        success: true,
        data: pollsByMarket,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[sentiment/polls] GET error", { step, error });
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : (() => {
              try {
                return JSON.stringify(error);
              } catch {
                return "Unknown error";
              }
            })();
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "투표 정보를 불러오는데 실패했습니다.",
          step,
          detail,
        },
      },
      { status: 500 }
    );
  }
}
