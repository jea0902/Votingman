/**
 * GET /api/sentiment/polls
 * 오늘(KST) 전체 시장 폴 정보 한 번에 조회
 * - 시장별 순차 호출 제거 → 폴 조회/생성, my_vote, count, OHLC를 병렬로 처리해 첫 응답 시간 단축
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateTodayPollByMarket } from "@/lib/sentiment/poll-server";
import { getPreviousCandleStartAt } from "@/lib/btc-ohlc/candle-utils";
import { getOhlcByMarketAndCandleStart } from "@/lib/btc-ohlc/repository";
import { fetchPreviousCandleClose } from "@/lib/binance/btc-klines";
import { SENTIMENT_MARKETS } from "@/lib/constants/sentiment-markets";

const BTC_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;

type PollPayload = {
  market: string;
  poll_id: string;
  poll_date: string;
  price_open: number | null;
  price_close: number | null;
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
  try {
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();
    const admin = createSupabaseAdmin();

    // 1) 모든 시장 폴 조회/생성 (순차 8번 → 1번 병렬)
    const pollResults = await Promise.all(
      SENTIMENT_MARKETS.map((market) => getOrCreateTodayPollByMarket(market))
    );
    const polls = pollResults.map((r) => r.poll);

    // 2) my_vote 1회 + 참여자 수 8회를 한 번에 병렬
    const pollIds = polls.map((p) => p.id);
    const myVotesPromise =
      user?.id
        ? admin
            .from("sentiment_votes")
            .select("poll_id, choice, bet_amount")
            .eq("user_id", user.id)
            .in("poll_id", pollIds)
        : Promise.resolve({ data: [] as { poll_id: string; choice: string; bet_amount: number }[] });

    const countPromises = polls.map((p) =>
      admin
        .from("sentiment_votes")
        .select("id", { count: "exact", head: true })
        .eq("poll_id", p.id)
        .gt("bet_amount", 0)
    );

    const [myVotesRes, ...countResults] = await Promise.all([
      myVotesPromise,
      ...countPromises,
    ]);

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
        const candleStartAt =
          "candle_start_at" in p && typeof p.candle_start_at === "string"
            ? p.candle_start_at
            : null;
        if (!candleStartAt) return { market, open: null as number | null, close: null as number | null };
        const previousCandleStartAt = getPreviousCandleStartAt(market, candleStartAt);
        const [prevOhlc, currentOhlc] = await Promise.all([
          getOhlcByMarketAndCandleStart(market, previousCandleStartAt),
          getOhlcByMarketAndCandleStart(market, candleStartAt),
        ]);
        let open: number | null = prevOhlc?.close ?? null;
        if (open == null) open = await fetchPreviousCandleClose(market, candleStartAt);
        return { market, open, close: currentOhlc?.close ?? null };
      });
    const ohlcResults = await Promise.all(btcOhlcPromises);
    const ohlcByMarket = new Map(
      ohlcResults.map((r) => [r.market, { open: r.open, close: r.close }])
    );

    // 4) 결과 조합
    const pollsByMarket: Record<string, PollPayload> = {};
    for (let i = 0; i < SENTIMENT_MARKETS.length; i++) {
      const market = SENTIMENT_MARKETS[i];
      const poll = polls[i];
      const participantCount = countResults[i]?.count ?? 0;
      const myVote = myVotesByPollId.get(poll.id) ?? null;
      const ohlc = ohlcByMarket.get(poll.market ?? market) ?? null;

      pollsByMarket[market] = {
        market: poll.market ?? market,
        poll_id: poll.id,
        poll_date: poll.poll_date,
        price_open: ohlc?.open ?? null,
        price_close: ohlc?.close ?? null,
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

    return NextResponse.json({
      success: true,
      data: pollsByMarket,
    });
  } catch (error) {
    console.error("[sentiment/polls] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "투표 정보를 불러오는데 실패했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
