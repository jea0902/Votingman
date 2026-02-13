"use client";

/**
 * 시장별 투표 카드 1개 (롱/숏 + 보팅코인 배팅)
 * HumanIndicatorSection에서 비트코인|미국주식|한국주식 섹션별로 사용
 */

import { useState, useMemo, useEffect } from "react";
import { isVotingOpenKST, getVotingCloseLabel } from "@/lib/utils/sentiment-vote";
import { MARKET_LABEL } from "@/lib/constants/sentiment-markets";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";

/** 시장별 투표 질문 문구 */
const POLL_QUESTION: Record<string, string> = {
  btc: "오늘 비트코인의 가격 방향을 어떻게 보시나요?",
  ndq: "오늘 나스닥100 지수(NDQ)의 가격 방향을 어떻게 보시나요?",
  sp500: "오늘 S&P500 지수의 가격 방향을 어떻게 보시나요?",
  kospi: "오늘 코스피 지수(KOSPI)의 가격 방향을 어떻게 보시나요?",
  kosdaq: "오늘 코스닥 지수(KOSDAQ)의 가격 방향을 어떻게 보시나요?",
};

/** 가용 코인 대비 배팅 비율 버튼 (%) */
const PERCENT_BUTTONS = [10, 25, 50, 75, 100] as const;
const MIN_BET = 10;

function stringifyBet(n: number): string {
  return n > 0 ? String(n) : "";
}

export type PollData = {
  market: string;
  poll_id: string;
  long_count: number;
  short_count: number;
  participant_count?: number;
  long_coin_total: number;
  short_coin_total: number;
  my_vote: { choice: "long" | "short"; bet_amount: number } | null;
};

function formatCoinRatio(
  longCoin: number,
  shortCoin: number,
  participantCount: number
) {
  const total = longCoin + shortCoin;
  if (total === 0) {
    return {
      longPct: 50,
      shortPct: 50,
      coinLabel: "롱 0 VTC (0%) / 숏 0 VTC (0%)",
      participantLabel: "0명 참여",
    };
  }
  const longPct = Math.round((longCoin / total) * 100);
  const shortPct = 100 - longPct;
  return {
    longPct,
    shortPct,
    coinLabel: `롱 ${longCoin.toLocaleString()} VTC (${longPct}%) / 숏 ${shortCoin.toLocaleString()} VTC (${shortPct}%)`,
    participantLabel: `${participantCount.toLocaleString()}명 참여`,
  };
}

type MarketRegimeData = {
  currentRegime: string | null;
  pastStats: { regime: string; longWinRatePct: number; shortWinRatePct: number; sampleCount: number }[];
} | null;

type Props = {
  market: SentimentMarket;
  poll: PollData | null;
  user: { nickname: string; voting_coin_balance?: number } | null;
  /** 투표/취소 성공 후 호출. data.new_balance 전달 시 즉시 잔액 반영 */
  onUpdate: (opts?: { new_balance?: number }) => void | Promise<void>;
};

export function MarketVoteCard({ market, poll, user, onUpdate }: Props) {
  const [voteLoading, setVoteLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [regimeData, setRegimeData] = useState<MarketRegimeData>(null);
  /** 입력란 자유 입력용 (빈 문자열 가능). 제출 시에만 최소 10코인 검사 */
  const [betAmountInput, setBetAmountInput] = useState(stringifyBet(MIN_BET));

  const voteOpen = useMemo(() => isVotingOpenKST(market), [market]);

  /** btc 시장만 시장세 API 연동 (6단계: 시장세 + 과거 시각화) */
  useEffect(() => {
    if (market !== "btc_1d") return;
    let cancelled = false;
    fetch(`/api/sentiment/market-regime?market=btc`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && json?.data) {
          const d = json.data;
          setRegimeData({
            currentRegime: d.currentRegime ?? null,
            pastStats: Array.isArray(d.pastStats) ? d.pastStats : [],
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [market]);
  const closeLabel = getVotingCloseLabel(market);

  const {
    longPct,
    shortPct,
    coinLabel,
    participantLabel,
    vote,
    myBetAmount,
  } = useMemo(() => {
    if (!poll) {
      return {
        longPct: 50,
        shortPct: 50,
        coinLabel: "—",
        participantLabel: "—",
        vote: null as "long" | "short" | null,
        myBetAmount: 0,
      };
    }
    const participantCount =
      typeof poll.participant_count === "number"
        ? poll.participant_count
        : (poll.long_count ?? 0) + (poll.short_count ?? 0);
    const { longPct: lp, shortPct: sp, coinLabel: cl, participantLabel: pl } =
      formatCoinRatio(
        poll.long_coin_total ?? 0,
        poll.short_coin_total ?? 0,
        participantCount
      );
    const mv = poll.my_vote;
    return {
      longPct: lp,
      shortPct: sp,
      coinLabel: cl,
      participantLabel: pl,
      vote: mv && mv.bet_amount > 0 ? mv.choice : null,
      myBetAmount: mv && mv.bet_amount > 0 ? mv.bet_amount : 0,
    };
  }, [poll]);

  const balance = user?.voting_coin_balance ?? 0;
  const availableBalance = balance + myBetAmount;
  const canBet = availableBalance >= MIN_BET;
  const maxBet = Math.max(0, Math.floor(availableBalance));
  const betNum = parseInt(betAmountInput, 10) || 0;
  const effectiveBet = betNum >= MIN_BET ? Math.min(maxBet, betNum) : 0;
  const canSubmitBet = canBet && effectiveBet >= MIN_BET;
  const showMinBetWarning = betAmountInput.trim() !== "" && betNum < MIN_BET;
  const canVote = voteOpen && !!user;

  const handleVote = async (choice: "long" | "short") => {
    if (!canVote || !canSubmitBet) return;
    if (vote === choice && myBetAmount === effectiveBet) return;
    setVoteError(null);
    setVoteLoading(true);
    try {
      const res = await fetch("/api/sentiment/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, choice, bet_amount: effectiveBet }),
      });
      const json = await res.json();
      if (!json?.success) {
        setVoteError(json?.error?.message ?? "투표에 실패했습니다.");
        return;
      }
      const newBalance = json?.data?.new_balance;
      await onUpdate(
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
      await onUpdate(
        typeof newBalance === "number" ? { new_balance: newBalance } : undefined
      );
    } catch {
      setVoteError("취소 요청에 실패했습니다.");
    } finally {
      setCancelLoading(false);
    }
  };

  const question = POLL_QUESTION[market] ?? MARKET_LABEL[market];

  return (
    <section
      className="rounded-xl border border-gray-500/40 bg-card/50 p-4 shadow-sm backdrop-blur-sm sm:p-5"
      aria-labelledby={`human-indicator-${market}`}
    >
      <h3
        id={`human-indicator-${market}`}
        className="mb-2 text-sm font-semibold text-foreground"
      >
        {question}
      </h3>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          {closeLabel}
          {!voteOpen && (
            <span className="ml-1.5 font-medium text-amber-500">· 오늘 투표 마감</span>
          )}
        </span>
      </div>

      {market === "btc_1d" && regimeData && (
        <div className="mb-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          {regimeData.currentRegime && (
            <p className="text-xs font-medium text-foreground">
              현재 시장세: <span className="text-primary">{regimeData.currentRegime}</span>
            </p>
          )}
          {regimeData.currentRegime && regimeData.pastStats.length > 0 && (() => {
            const stat = regimeData.pastStats.find((s) => s.regime === regimeData.currentRegime);
            if (!stat || stat.sampleCount < 5) return null;
            return (
              <p className="mt-1 text-[10px] text-muted-foreground">
                과거 {regimeData.currentRegime}일 때: 롱 당첨 {stat.longWinRatePct}% / 숏 당첨 {stat.shortWinRatePct}%
                <span className="ml-1 text-[9px] opacity-80">({stat.sampleCount}일)</span>
              </p>
            );
          })()}
        </div>
      )}

      <div className="mb-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium text-emerald-500">롱 {longPct}%</span>
          <span className="font-medium text-rose-500">숏 {shortPct}%</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${longPct}%` }}
          />
          <div
            className="bg-rose-500 transition-all duration-500 ease-out"
            style={{ width: `${shortPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{coinLabel}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{participantLabel}</p>
      </div>

      {voteOpen && (
        <p className="mb-3 text-center text-xs text-muted-foreground">
          마감 전까지 수정 및 취소 가능합니다.
        </p>
      )}

      {canVote && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-foreground">몇 VTC 걸까요?</p>
          <div className="flex flex-wrap gap-2">
            {PERCENT_BUTTONS.map((pct) => {
              const valueForPct = Math.max(MIN_BET, Math.min(maxBet, Math.floor((availableBalance * pct) / 100)));
              const isActive = betNum === valueForPct;
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setBetAmountInput(stringifyBet(valueForPct))}
                  disabled={maxBet < MIN_BET}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={betAmountInput}
              onChange={(e) => setBetAmountInput(e.target.value.replace(/\D/g, ""))}
              placeholder="VTC 입력"
              className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm tabular-nums"
            />
            <span className="text-xs text-muted-foreground">
              VTC (잔액 : <span className="font-semibold text-amber-500">{balance.toLocaleString()} VTC</span>)
            </span>
          </div>
          {showMinBetWarning && (
            <p className="mt-1.5 text-xs font-medium text-destructive" role="alert">
              최소 10 VTC 이상 배팅해 주세요.
            </p>
          )}
        </div>
      )}

      {voteError && (
        <p className="mb-3 text-center text-sm text-destructive" role="alert">
          {voteError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handleVote("long")}
          disabled={!canVote || !canSubmitBet || voteLoading}
          className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border-2 py-4 text-emerald-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ${
            vote === "long"
              ? "border-emerald-400 bg-emerald-500/25 shadow-md"
              : "border-emerald-500/60 bg-emerald-500/10 hover:border-emerald-400 hover:bg-emerald-500/20"
          }`}
          aria-pressed={vote === "long"}
        >
          <span className="text-2xl font-bold sm:text-3xl">↑ 롱</span>
          <span className="mt-1 text-xs text-muted-foreground">상승 예상</span>
        </button>
        <button
          type="button"
          onClick={() => handleVote("short")}
          disabled={!canVote || !canSubmitBet || voteLoading}
          className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border-2 py-4 text-rose-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ${
            vote === "short"
              ? "border-rose-400 bg-rose-500/25 shadow-md"
              : "border-rose-500/60 bg-rose-500/10 hover:border-rose-400 hover:bg-rose-500/20"
          }`}
          aria-pressed={vote === "short"}
        >
          <span className="text-2xl font-bold sm:text-3xl">↓ 숏</span>
          <span className="mt-1 text-xs text-muted-foreground">하락 예상</span>
        </button>
      </div>

      {canVote && myBetAmount > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm text-muted-foreground">
            {vote === "long" ? "롱" : "숏"}에{" "}
            <span className="font-medium text-foreground">{myBetAmount.toLocaleString()} VTC</span>
            을 배팅하셨습니다. 행운을 빕니다.
          </span>
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelLoading}
            className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-60"
          >
            {cancelLoading ? "처리 중…" : "투표 취소 버튼"}
          </button>
        </div>
      )}
    </section>
  );
}
