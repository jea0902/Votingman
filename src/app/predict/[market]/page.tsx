"use client";

/**
 * 예측 시장 상세 페이지 (Polymarket 스타일)
 *
 * - 왼쪽: PRICE TO BEAT, CURRENT PRICE, TradingView 차트 (target 가격 표시), Rules 탭
 * - 오른쪽: 잔액, UP/DOWN 버튼, Amount, Trade 버튼
 * - 하단: 관련 시장 링크
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  isVotingOpenKST,
  getVotingCloseLabel,
} from "@/lib/utils/sentiment-vote";
import {
  MARKET_LABEL,
  SENTIMENT_MARKETS,
  isSentimentMarket,
} from "@/lib/constants/sentiment-markets";
import { createClient } from "@/lib/supabase/client";
import { BtcChart } from "@/components/predict/BtcChart";
import { PollRulesContent } from "@/components/predict/PollRulesContent";
import { MarketContextContent } from "@/components/predict/MarketContextContent";
import { CountdownTimer } from "@/components/predict/CountdownTimer";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import type { PollData } from "@/components/home/MarketVoteCard";

const PERCENT_BUTTONS = [10, 25, 50, 75, 100] as const;
const MIN_BET = 10;

function stringifyBet(n: number): string {
  return n > 0 ? String(n) : "";
}

/** 시장별 카드 제목 */
const CARD_TITLE: Record<string, string> = {
  btc: "비트코인 1일동안 상승/하락",
  ndq: "나스닥100 상승/하락",
  sp500: "S&P 500 상승/하락",
  kospi: "코스피 상승/하락",
  kosdaq: "코스닥 상승/하락",
};

export default function PredictMarketPage() {
  const params = useParams();
  const marketParam = typeof params?.market === "string" ? params.market : "";
  const market = isSentimentMarket(marketParam) ? marketParam : "btc";

  const [poll, setPoll] = useState<(PollData & { price_open?: number; price_close?: number }) | null>(null);
  const [user, setUser] = useState<{
    nickname: string;
    voting_coin_balance?: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"rules" | "context">("rules");
  const [betAmountInput, setBetAmountInput] = useState(stringifyBet(MIN_BET));
  const [voteLoading, setVoteLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  const voteOpen = useMemo(() => isVotingOpenKST(market), [market]);
  const closeLabel = getVotingCloseLabel(market);
  const title = CARD_TITLE[market] ?? `${MARKET_LABEL[market]} 상승/하락`;

  const refetchUser = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data } = await supabase
      .from("users")
      .select("nickname, voting_coin_balance")
      .eq("user_id", session.user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) {
      setUser({
        nickname: data.nickname,
        voting_coin_balance:
          data.voting_coin_balance != null
            ? Number(data.voting_coin_balance)
            : undefined,
      });
    }
  }, []);

  const fetchPoll = useCallback(async () => {
    try {
      const res = await fetch(`/api/sentiment/poll?market=${market}`);
      const json = await res.json();
      if (json?.success && json?.data) {
        const d = json.data;
        setPoll({
          market: d.market,
          poll_id: d.poll_id,
          long_count: d.long_count ?? 0,
          short_count: d.short_count ?? 0,
          long_coin_total: d.long_coin_total ?? 0,
          short_coin_total: d.short_coin_total ?? 0,
          my_vote: d.my_vote ?? null,
          price_open: d.price_open,
          price_close: d.price_close,
        });
      }
    } catch {
      setPoll(null);
    }
  }, [market]);

  /** btc 현재가 조회 (Binance 공개 API) */
  useEffect(() => {
    if (market !== "btc") return;
    let cancelled = false;
    fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.price) {
          setCurrentPrice(Number(data.price));
        }
      })
      .catch(() => {});
    const id = setInterval(() => {
      if (cancelled) return;
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data?.price) {
            setCurrentPrice(Number(data.price));
          }
        })
        .catch(() => {});
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [market]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data } = await supabase
        .from("users")
        .select("nickname, voting_coin_balance")
        .eq("user_id", session.user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (data) {
        setUser({
          nickname: data.nickname,
          voting_coin_balance:
            data.voting_coin_balance != null
              ? Number(data.voting_coin_balance)
              : undefined,
        });
      }
    });
  }, []);

  const refetch = useCallback(
    async (opts?: { new_balance?: number }) => {
      if (
        opts?.new_balance != null &&
        typeof opts.new_balance === "number"
      ) {
        setUser((prev) =>
          prev ? { ...prev, voting_coin_balance: opts.new_balance } : null
        );
      }
      await fetchPoll();
      await refetchUser();
    },
    [fetchPoll, refetchUser]
  );

  const priceToBeat = poll?.price_open ?? null;
  const balance = user?.voting_coin_balance ?? 0;
  const myBetAmount =
    poll?.my_vote && poll.my_vote.bet_amount > 0 ? poll.my_vote.bet_amount : 0;
  const vote = poll?.my_vote && poll.my_vote.bet_amount > 0 ? poll.my_vote.choice : null;
  const availableBalance = balance + myBetAmount;
  const maxBet = Math.max(0, Math.floor(availableBalance));
  const betNum = parseInt(betAmountInput, 10) || 0;
  const effectiveBet =
    betNum >= MIN_BET ? Math.min(maxBet, betNum) : 0;
  const canSubmitBet = availableBalance >= MIN_BET && effectiveBet >= MIN_BET;
  const canVote = voteOpen && !!user;
  const longPct =
    poll && (poll.long_coin_total ?? 0) + (poll.short_coin_total ?? 0) > 0
      ? Math.round(
          ((poll.long_coin_total ?? 0) /
            ((poll.long_coin_total ?? 0) + (poll.short_coin_total ?? 0))) *
            100
        )
      : 50;

  const handleVote = async (choice: "long" | "short") => {
    if (!canVote || !canSubmitBet) return;
    if (vote === choice && myBetAmount === effectiveBet) return;
    setVoteError(null);
    setVoteLoading(true);
    try {
      const res = await fetch("/api/sentiment/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market,
          choice,
          bet_amount: effectiveBet,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        setVoteError(json?.error?.message ?? "투표에 실패했습니다.");
        return;
      }
      const newBalance = json?.data?.new_balance;
      await refetch(
        typeof newBalance === "number" ? { new_balance: newBalance } : undefined
      );
    } catch {
      setVoteError("투표 요청에 실패했습니다.");
    } finally {
      setVoteLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!canVote || myBetAmount <= 0) return;
    setVoteError(null);
    setCancelLoading(true);
    try {
      const res = await fetch("/api/sentiment/vote/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market }),
      });
      const json = await res.json();
      if (!json?.success) {
        setVoteError(json?.error?.message ?? "취소에 실패했습니다.");
        return;
      }
      const newBalance = json?.data?.new_balance;
      await refetch(
        typeof newBalance === "number" ? { new_balance: newBalance } : undefined
      );
    } catch {
      setVoteError("취소 요청에 실패했습니다.");
    } finally {
      setCancelLoading(false);
    }
  };

  const relatedMarkets = SENTIMENT_MARKETS.filter((m) => m !== market);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-xl font-bold text-amber-500">
              {market.toUpperCase()}
            </span>
            <div>
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{closeLabel}</p>
            </div>
          </div>
          {voteOpen && (
            <div className="flex flex-col items-end">
              <p className="text-xs text-muted-foreground">마감까지</p>
              <CountdownTimer market={market} />
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                목표가 (시가)
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {priceToBeat != null
                  ? `$${priceToBeat.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                현재가
              </p>
              <p className="mt-1 text-lg font-bold text-amber-500">
                {currentPrice != null
                  ? `$${currentPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : market === "btc"
                    ? "불러오는 중…"
                    : "—"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {market === "btc" ? (
              <BtcChart targetPrice={priceToBeat} className="min-h-[400px]" />
            ) : (
              <div className="flex h-[500px] items-center justify-center rounded-lg border-border bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  차트는 비트코인 시장에서만 제공됩니다.
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex gap-2 border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab("rules")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "rules"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Rules
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("context")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "context"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Market Context
              </button>
            </div>
            {activeTab === "rules" && <PollRulesContent market={market} />}
            {activeTab === "context" && (
              <MarketContextContent market={market} />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-4 text-sm font-medium text-foreground">
              잔액 :{" "}
              <span className="font-semibold text-amber-500">
                {(user?.voting_coin_balance ?? 0).toLocaleString()} VTC
              </span>
            </p>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleVote("long")}
                disabled={!canVote || !canSubmitBet || voteLoading}
                className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl border-2 py-4 text-emerald-400 transition-all disabled:pointer-events-none disabled:opacity-60 ${
                  vote === "long"
                    ? "border-emerald-400 bg-emerald-500/25"
                    : "border-emerald-500/60 bg-emerald-500/10 hover:border-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                <span className="text-2xl font-bold">Up</span>
                <span className="text-xs text-muted-foreground">
                  롱 {longPct}%
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleVote("short")}
                disabled={!canVote || !canSubmitBet || voteLoading}
                className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl border-2 py-4 text-rose-400 transition-all disabled:pointer-events-none disabled:opacity-60 ${
                  vote === "short"
                    ? "border-rose-400 bg-rose-500/25"
                    : "border-rose-500/60 bg-rose-500/10 hover:border-rose-400 hover:bg-rose-500/20"
                }`}
              >
                <span className="text-2xl font-bold">Down</span>
                <span className="text-xs text-muted-foreground">
                  숏 {100 - longPct}%
                </span>
              </button>
            </div>

            {canVote && (
              <>
                <p className="mb-2 text-sm font-medium text-foreground">
                  Amount (VTC)
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {PERCENT_BUTTONS.map((pct) => {
                    const val = Math.max(
                      MIN_BET,
                      Math.min(
                        maxBet,
                        Math.floor((availableBalance * pct) / 100)
                      )
                    );
                    const isActive = betNum === val;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setBetAmountInput(stringifyBet(val))}
                        disabled={maxBet < MIN_BET}
                        className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ${
                          isActive
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={betAmountInput}
                    onChange={(e) =>
                      setBetAmountInput(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="VTC"
                    className="h-10 w-28 rounded-lg border border-border bg-background px-3 text-sm tabular-nums"
                  />
                </div>
              </>
            )}

            {!user && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link href="/login" className="text-primary hover:underline">
                  로그인
                </Link>
                {" 후 배팅할 수 있습니다."}
              </p>
            )}

            {voteError && (
              <p className="mt-4 text-center text-sm text-destructive">
                {voteError}
              </p>
            )}

            {canVote && myBetAmount > 0 && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {vote === "long" ? "롱" : "숏"} {myBetAmount.toLocaleString()}{" "}
                  VTC 배팅 중
                </span>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelLoading}
                  className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20"
                >
                  {cancelLoading ? "처리 중…" : "취소"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h3 className="mb-4 text-base font-semibold text-foreground">
          다른 시장
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {relatedMarkets.map((m) => (
            <Link
              key={m}
              href={`/predict/${m}`}
              className="rounded-xl border border-border bg-card/50 p-4 transition-colors hover:border-primary/50 hover:bg-card"
            >
              <span className="font-medium text-foreground">
                {CARD_TITLE[m] ?? `${MARKET_LABEL[m]} 상승/하락`}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
