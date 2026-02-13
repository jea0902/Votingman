"use client";

/**
 * 시장별 투표 카드 - 홈용 단순 버전 (Polymarket 스타일)
 * - 제목, 롱/숏 비율, UP/DOWN 버튼에 상세 페이지 링크
 * - 배팅 UI는 상세 페이지에서만 제공
 */

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { isVotingOpenKST } from "@/lib/utils/sentiment-vote";
import { MARKET_LABEL } from "@/lib/constants/sentiment-markets";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import type { PollData } from "./MarketVoteCard";

/** 시장별 카드 제목 (상승/하락 예측) */
const CARD_TITLE: Record<string, string> = {
  btc_1d: "[1일 후] 비트코인 상승/하락",
  btc_4h: "[4시간 후] 비트코인 상승/하락",
  btc_1h: "[1시간 후] 비트코인 상승/하락",
  btc_15m: "[15분 후] 비트코인 상승/하락",
  ndq: "나스닥100 상승/하락",
  sp500: "S&P 500 상승/하락",
  kospi: "코스피 상승/하락",
  kosdaq: "코스닥 상승/하락",
};

/** btc 계열 시간봉 라벨 */
const TIMEFRAME_LABEL: Record<string, string> = {
  btc_1d: "1D",
  btc_4h: "4H",
  btc_1h: "1H",
  btc_15m: "15m",
};

/** btc 계열 여부 */
const BTC_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;
function isBtcMarket(m: string): m is (typeof BTC_MARKETS)[number] {
  return BTC_MARKETS.includes(m as (typeof BTC_MARKETS)[number]);
}

/** 시장별 아이콘 라벨 (ndq 등 비btc용) */
const MARKET_ICON: Record<string, string> = {
  ndq: "NDQ",
  sp500: "SPX",
  kospi: "KOSPI",
  kosdaq: "KOSDAQ",
};

function formatRatio(longCoin: number, shortCoin: number, participantCount: number) {
  const total = longCoin + shortCoin;
  if (total === 0) return { longPct: 50, shortPct: 50 };
  const longPct = Math.round((longCoin / total) * 100);
  return { longPct, shortPct: 100 - longPct };
}

type Props = {
  market: SentimentMarket;
  poll: PollData | null;
};

export function MarketVoteCardCompact({ market, poll }: Props) {
  const voteOpen = useMemo(() => isVotingOpenKST(market), [market]);

  const { longPct, shortPct, totalCoin, participantCount } = useMemo(() => {
    if (!poll) {
      return { longPct: 50, shortPct: 50, totalCoin: 0, participantCount: 0 };
    }
    const pc =
      typeof poll.participant_count === "number"
        ? poll.participant_count
        : (poll.long_count ?? 0) + (poll.short_count ?? 0);
    const { longPct: lp, shortPct: sp } = formatRatio(
      poll.long_coin_total ?? 0,
      poll.short_coin_total ?? 0,
      pc
    );
    const total =
      (poll.long_coin_total ?? 0) + (poll.short_coin_total ?? 0);
    return { longPct: lp, shortPct: sp, totalCoin: total, participantCount: pc };
  }, [poll]);

  const detailHref = `/predict/${market}`;
  const title = CARD_TITLE[market] ?? `${MARKET_LABEL[market]} 상승/하락`;
  const icon = MARKET_ICON[market] ?? market.toUpperCase();
  const timeframeLabel = isBtcMarket(market) ? TIMEFRAME_LABEL[market] : null;

  return (
    <div
      className="rounded-xl border border-gray-500/40 bg-card/50 p-4 shadow-sm backdrop-blur-sm transition-colors hover:border-gray-500/70 hover:bg-card/70 sm:p-5"
      aria-labelledby={`compact-${market}`}
    >
      <Link href={detailHref} className="block mb-3">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isBtcMarket(market) ? (
            <div
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/20 px-2"
              aria-hidden
            >
              <Image
                src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                alt=""
                width={24}
                height={24}
                className="shrink-0"
              />
              <span className="text-xs font-bold text-amber-500">
                {timeframeLabel}
              </span>
            </div>
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-lg font-bold text-amber-500"
              aria-hidden
            >
              {icon}
            </span>
          )}
          <h3
            id={`compact-${market}`}
            className="text-sm font-semibold text-foreground"
          >
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-emerald-500">
            롱 {longPct}%
          </span>
        </div>
      </div>
      </Link>

      <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${longPct}%` }}
        />
        <div
          className="bg-rose-500 transition-all duration-500 ease-out"
          style={{ width: `${shortPct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`${detailHref}?choice=long`}
          className="flex min-h-[52px] flex-col items-center justify-center rounded-xl border-2 border-emerald-500/60 bg-emerald-500/10 py-4 text-emerald-400 transition-all hover:border-emerald-400 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <span className="text-2xl font-bold sm:text-3xl">Up</span>
          <span className="mt-1 text-xs text-muted-foreground">상승 예상</span>
        </Link>
        <Link
          href={`${detailHref}?choice=short`}
          className="flex min-h-[52px] flex-col items-center justify-center rounded-xl border-2 border-rose-500/60 bg-rose-500/10 py-4 text-rose-400 transition-all hover:border-rose-400 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <span className="text-2xl font-bold sm:text-3xl">Down</span>
          <span className="mt-1 text-xs text-muted-foreground">하락 예상</span>
        </Link>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
              voteOpen ? "bg-red-500" : "bg-gray-500"
            }`}
          />
          {voteOpen ? "LIVE" : "CLOSED"}
        </span>
        <span>{totalCoin.toLocaleString()} VTC · {participantCount}명 참여</span>
      </div>
    </div>
  );
}
