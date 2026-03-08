"use client";

/**
 * 시장별 투표 카드 - 홈용 단순 버전 (Polymarket 스타일)
 * - 제목, 롱/숏 비율, UP/DOWN 버튼에 상세 페이지 링크
 * - 배팅 UI는 상세 페이지에서만 제공
 */

import Link from "next/link";
import { useMemo } from "react";
import { MarketIcon } from "@/components/market/MarketIcon";
import { isVotingOpenKST, getCloseTimeKstString } from "@/lib/utils/sentiment-vote";
import { MARKET_LABEL } from "@/lib/constants/sentiment-markets";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import type { PollData } from "./MarketVoteCard";

/** 시장별 카드 제목 - 2줄: 1줄=시간+종목, 2줄=상승 or 하락 */
const CARD_TITLE_LINE1: Record<string, string> = {
  btc_1d: "1일 후 BTC",
  btc_4h: "4시간 후 BTC",
  btc_1h: "1시간 후 BTC",
  btc_15m: "15분 후 BTC",
  btc_5m: "5분 후 BTC",
  ndq: "NDQ",
  sp500: "SPX",
  kospi: "코스피",
  kosdaq: "코스닥",
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
  const titleLine1 = CARD_TITLE_LINE1[market] ?? MARKET_LABEL[market];
  const titleLine2 = "상승 or 하락";

  return (
    <div
      className="rounded-xl border border-gray-500/40 bg-card/50 p-4 shadow-sm backdrop-blur-sm transition-colors hover:border-gray-500/70 hover:bg-card/70 sm:p-5"
      aria-labelledby={`compact-${market}`}
    >
      <Link href={detailHref} className="block mb-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div aria-hidden>
            <MarketIcon market={market} size="compact" showTimeframe />
          </div>
          <h3 id={`compact-${market}`} className="min-w-0 text-sm font-semibold text-foreground">
            <span className="block text-xs leading-tight text-muted-foreground">{titleLine1}</span>
            <span className="block leading-tight">{titleLine2}</span>
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {longPct > shortPct ? (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              상승 {longPct}%
            </span>
          ) : shortPct > longPct ? (
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
              하락 {shortPct}%
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              50:50
            </span>
          )}
        </div>
      </div>
      </Link>

      <p className="mb-3 text-xs text-muted-foreground">
        {voteOpen ? getCloseTimeKstString(market, poll?.candle_start_at) : "마감"}
      </p>

      <div className="mb-3 flex h-1.5 overflow-hidden rounded-full bg-muted sm:mb-4 sm:h-2">
        <div
          className="bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${longPct}%` }}
        />
        <div
          className="bg-rose-500 transition-all duration-500 ease-out"
          style={{ width: `${shortPct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Link
          href={`${detailHref}?choice=long`}
          className="flex min-h-[32px] flex-col items-center justify-center rounded-lg border-2 border-emerald-500/60 bg-emerald-500/10 py-1.5 text-emerald-400 transition-all hover:border-emerald-400 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:min-h-[36px] sm:rounded-xl sm:py-2"
        >
          <span className="text-base font-bold sm:text-lg">Up</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">상승</span>
        </Link>
        <Link
          href={`${detailHref}?choice=short`}
          className="flex min-h-[32px] flex-col items-center justify-center rounded-lg border-2 border-rose-500/60 bg-rose-500/10 py-1.5 text-rose-400 transition-all hover:border-rose-400 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 sm:min-h-[36px] sm:rounded-xl sm:py-2"
        >
          <span className="text-base font-bold sm:text-lg">Down</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">하락</span>
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
