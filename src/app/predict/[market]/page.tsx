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
import Image from "next/image";
import {
  isVotingOpenKST,
  getCloseTimeKstString,
  getNextOpenTimeKstString,
} from "@/lib/utils/sentiment-vote";
import {
  MARKET_LABEL,
  ACTIVE_MARKETS,
  isSentimentMarket,
  normalizeToDbMarket,
} from "@/lib/constants/sentiment-markets";
import { createClient } from "@/lib/supabase/client";
import { BtcChart } from "@/components/predict/BtcChart";
import { PollRulesContent } from "@/components/predict/PollRulesContent";
import { MarketContextContent } from "@/components/predict/MarketContextContent";
import { CountdownTimer } from "@/components/predict/CountdownTimer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";
import type { PollData } from "@/components/home/MarketVoteCard";

const PERCENT_BUTTONS = [10, 25, 50, 75, 100] as const;
const MIN_BET = 10;
const FINAL_ANSWER_LINE1 = "투표는 한번하면, 절대 번복할 수 없습니다.";
const FINAL_ANSWER_LINE2 = "확정하시겠습니까?";

/** 하이드레이션 방지: 서버/클라이언트 동일 출력용 고정 로케일 */
const FIXED_LOCALE = "ko-KR";

function stringifyBet(n: number): string {
  return n > 0 ? String(n) : "";
}

/** 시장별 카드 제목 */
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

export default function PredictMarketPage() {
  const params = useParams();
  const marketParam = typeof params?.market === "string" ? params.market : "";
  const market = normalizeToDbMarket(marketParam || "btc_1d");

  const [poll, setPoll] = useState<(PollData & { price_open?: number; price_close?: number }) | null>(null);
  const [user, setUser] = useState<{
    nickname: string;
    voting_coin_balance?: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"rules" | "context">("rules");
  const [betAmountInput, setBetAmountInput] = useState(stringifyBet(MIN_BET));
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [confirmingChoice, setConfirmingChoice] = useState<"long" | "short" | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const voteOpen = useMemo(() => isVotingOpenKST(market), [market]);
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

  /** btc 계열 현재가 조회 (Binance 공개 API) */
  const isBtcMarket = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"].includes(market);
  useEffect(() => {
    if (!isBtcMarket) return;
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
  }, [isBtcMarket]);

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
  const isAdditionalMode = myBetAmount > 0 && vote !== null;
  const availableBalance = isAdditionalMode ? balance : balance + myBetAmount;
  const maxBet = Math.max(0, Math.floor(availableBalance));
  const betNum = parseInt(betAmountInput, 10) || 0;
  const effectiveBet =
    betNum >= MIN_BET ? Math.min(maxBet, betNum) : 0;
  const canSubmitBet = availableBalance >= MIN_BET && effectiveBet >= MIN_BET;
  const canSubmitAdditional =
    isAdditionalMode &&
    balance >= MIN_BET &&
    effectiveBet >= MIN_BET &&
    effectiveBet <= balance;
  const canSubmitForChoice = (choice: "long" | "short") =>
    isAdditionalMode ? choice === vote && canSubmitAdditional : canSubmitBet;
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
    const totalBet =
      isAdditionalMode && choice === vote ? myBetAmount + effectiveBet : effectiveBet;
    if (!canVote || !canSubmitForChoice(choice)) return;
    if (vote === choice && myBetAmount === totalBet) return;
    setVoteError(null);
    setVoteLoading(true);
    setConfirmingChoice(null);
    try {
      const res = await fetch("/api/sentiment/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market,
          choice,
          bet_amount: totalBet,
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

  const onVoteButtonClick = (choice: "long" | "short") => {
    if (!canVote || !canSubmitForChoice(choice)) return;
    if (myBetAmount > 0 && choice !== vote) return;
    setConfirmingChoice(choice);
  };

  const relatedMarkets = ACTIVE_MARKETS.filter((m) => m !== market);

  const timeframeLabels: Record<string, string> = {
    btc_1d: "1D",
    btc_4h: "4H",
    btc_1h: "1H",
    btc_15m: "15m",
  };
  const isBtcMarketHeader = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"].includes(market);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            {isBtcMarketHeader ? (
              <div className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-amber-500/20 px-2.5">
                <Image
                  src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
                  alt=""
                  width={28}
                  height={28}
                  className="shrink-0"
                />
                <span className="text-sm font-bold text-amber-500">
                  {timeframeLabels[market] ?? market}
                </span>
              </div>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-xl font-bold text-amber-500">
                {market.toUpperCase()}
              </span>
            )}
            <div className="flex flex-col gap-0.5">
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                {mounted
                  ? voteOpen
                    ? getCloseTimeKstString(market)
                    : `${getNextOpenTimeKstString(market)} 다시 투표 가능`
                  : "\u00A0"}
              </p>
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
        {/* 1) 가격 + 차트 (모바일: 맨 위, lg: 왼쪽 상단) */}
        <div className="order-1 space-y-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                목표가 (시가)
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {priceToBeat != null
                  ? `$${priceToBeat.toLocaleString(FIXED_LOCALE, {
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
                  ? `$${currentPrice.toLocaleString(FIXED_LOCALE, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : isBtcMarket
                    ? "불러오는 중…"
                    : "—"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {isBtcMarket ? (
              <BtcChart
                targetPrice={priceToBeat}
                defaultInterval="1m"
                className="min-h-[400px]"
              />
            ) : (
              <div className="flex h-[500px] items-center justify-center rounded-lg border-border bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  차트는 비트코인 시장에서만 제공됩니다.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 2) 배팅 박스 (모바일: 차트 바로 아래, lg: 오른쪽) */}
        <div className="order-2 space-y-6">
          {!voteOpen && mounted && (
            <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 text-center">
              <p className="text-base font-semibold text-amber-500">
                이 투표는 마감되었습니다.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getNextOpenTimeKstString(market)}부터 다시 투표할 수 있습니다.
              </p>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-4 text-sm font-medium text-foreground">
              잔액 :{" "}
              <span className="font-semibold text-amber-500">
                {(user?.voting_coin_balance ?? 0).toLocaleString(FIXED_LOCALE)} VTC
              </span>
            </p>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onVoteButtonClick("long")}
                disabled={
                  !canVote ||
                  voteLoading ||
                  (myBetAmount > 0 && vote === "short") ||
                  !canSubmitForChoice("long")
                }
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
                onClick={() => onVoteButtonClick("short")}
                disabled={
                  !canVote ||
                  voteLoading ||
                  (myBetAmount > 0 && vote === "long") ||
                  !canSubmitForChoice("short")
                }
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
                  {isAdditionalMode ? "추가할 VTC" : "Amount (VTC)"}
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

            {myBetAmount > 0 && vote && (
              <p className="mt-4 whitespace-pre-line text-center text-sm font-semibold text-amber-500">
                {`${vote === "long" ? "롱" : "숏"} ${myBetAmount.toLocaleString(FIXED_LOCALE)} VTC 투표 확정.\n추가 투표는 같은 선택으로만 가능`}
              </p>
            )}

            <Dialog open={confirmingChoice !== null} onOpenChange={(open) => !open && setConfirmingChoice(null)}>
              <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>투표 확정</DialogTitle>
                </DialogHeader>
                <p className="text-sm font-medium text-red-500">{FINAL_ANSWER_LINE1}</p>
                <p className="text-sm font-medium text-white">{FINAL_ANSWER_LINE2}</p>
                <DialogFooter className="gap-2 sm:gap-0">
                  <button
                    type="button"
                    onClick={() => setConfirmingChoice(null)}
                    className="rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    돌아가기
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmingChoice && handleVote(confirmingChoice)}
                    disabled={voteLoading}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {voteLoading ? "처리 중…" : "확정"}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* 배팅 현황: UP/DOWN 각각 배팅된 VTC */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              이 투표지 배팅 현황
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-emerald-400/90">UP (롱)</p>
                  <span className="text-xs tabular-nums text-emerald-400/80">
                    {(poll?.long_count ?? 0).toLocaleString(FIXED_LOCALE)}명
                  </span>
                </div>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-400">
                  {(poll?.long_coin_total ?? 0).toLocaleString(FIXED_LOCALE)} VTC
                </p>
              </div>
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-rose-400/90">DOWN (숏)</p>
                  <span className="text-xs tabular-nums text-rose-400/80">
                    {(poll?.short_count ?? 0).toLocaleString(FIXED_LOCALE)}명
                  </span>
                </div>
                <p className="mt-1 text-lg font-bold tabular-nums text-rose-400">
                  {(poll?.short_coin_total ?? 0).toLocaleString(FIXED_LOCALE)} VTC
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3) Rules / Market Context (모바일: 맨 아래, lg: 왼쪽 하단) */}
        <div className="order-3 space-y-6 lg:col-span-2">
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
