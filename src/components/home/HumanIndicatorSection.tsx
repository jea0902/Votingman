"use client";

/**
 * HumanIndicatorSection – 인간 지표 (데일리 롱/숏 + 보팅코인 배팅)
 *
 * - 로그인 시에만 투표 가능. 비율은 걸린 코인 수 기준(long_coin_total / short_coin_total).
 * - "몇 코인 걸까?" 입력 후 롱/숏 선택. 마감 전 수정·취소 가능.
 * - GET /api/sentiment/poll, POST /api/sentiment/vote, POST /api/sentiment/vote/cancel
 */

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { isVotingOpenKST, VOTING_CLOSE_LABEL } from "@/lib/utils/sentiment-vote";

type VoteChoice = "long" | "short" | null;

/** 오늘 00:00 KST 시가 플레이스홀더 (추후 API 연동) */
const BTC_PRICE_PLACEHOLDER = { usd: "—", krw: "—" };

const PRESET_COINS = [10, 50, 100] as const;

/** 코인 수 기준 비율 및 라벨 (롱 N코인 (a%) / 숏 M코인 (b%)) */
function formatCoinRatio(
  longCoin: number,
  shortCoin: number,
  participantCount: number
): { longPct: number; shortPct: number; coinLabel: string; participantLabel: string } {
  const total = longCoin + shortCoin;
  if (total === 0) {
    return {
      longPct: 50,
      shortPct: 50,
      coinLabel: "롱 0코인 (0%) / 숏 0코인 (0%)",
      participantLabel: "0명 참여",
    };
  }
  const longPct = Math.round((longCoin / total) * 100);
  const shortPct = 100 - longPct;
  return {
    longPct,
    shortPct,
    coinLabel: `롱 ${longCoin.toLocaleString()}코인 (${longPct}%) / 숏 ${shortCoin.toLocaleString()}코인 (${shortPct}%)`,
    participantLabel: `${participantCount.toLocaleString()}명 참여`,
  };
}

export function HumanIndicatorSection() {
  const [vote, setVote] = useState<VoteChoice>(null);
  const [myBetAmount, setMyBetAmount] = useState(0);
  const [longPct, setLongPct] = useState(50);
  const [shortPct, setShortPct] = useState(50);
  const [coinLabel, setCoinLabel] = useState("—");
  const [participantLabel, setParticipantLabel] = useState("—");
  const [voteOpen, setVoteOpen] = useState(() => isVotingOpenKST());
  const [user, setUser] = useState<{ nickname: string; voting_coin_balance?: number } | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [voteLoading, setVoteLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [accuracy, setAccuracy] = useState<{
    longPct: number | null;
    shortPct: number | null;
  }>({ longPct: null, shortPct: null });

  const refetchUser = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data } = await supabase
      .from("users")
      .select("nickname, voting_coin_balance")
      .eq("user_id", session.user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) setUser({ nickname: data.nickname, voting_coin_balance: data.voting_coin_balance != null ? Number(data.voting_coin_balance) : undefined });
  }, []);

  const fetchPoll = useCallback(async () => {
    try {
      const res = await fetch("/api/sentiment/poll");
      const json = await res.json();
      if (json?.success && json?.data) {
        const d = json.data;
        const longCoin = Number(d.long_coin_total ?? 0);
        const shortCoin = Number(d.short_coin_total ?? 0);
        const participantCount = (d.long_count ?? 0) + (d.short_count ?? 0);
        const { longPct: lp, shortPct: sp, coinLabel: cl, participantLabel: pl } = formatCoinRatio(longCoin, shortCoin, participantCount);
        setLongPct(lp);
        setShortPct(sp);
        setCoinLabel(cl);
        setParticipantLabel(pl);
        const mv = d.my_vote;
        if (mv && Number(mv.bet_amount) > 0) {
          setVote(mv.choice);
          setMyBetAmount(Number(mv.bet_amount));
        } else {
          setVote(null);
          setMyBetAmount(0);
        }
      }
    } catch {
      setCoinLabel("—");
      setParticipantLabel("—");
    }
  }, []);

  useEffect(() => {
    setVoteOpen(isVotingOpenKST());
    const interval = setInterval(() => setVoteOpen(isVotingOpenKST()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setUserLoading(false);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("nickname, voting_coin_balance")
        .eq("user_id", session.user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (data) setUser({ nickname: data.nickname, voting_coin_balance: data.voting_coin_balance != null ? Number(data.voting_coin_balance) : undefined });
      setUserLoading(false);
    });
  }, []);

  const MIN_BET = 10;
  const canVote = voteOpen && !!user;
  const balance = user?.voting_coin_balance ?? 0;
  const availableBalance = balance + myBetAmount;
  const canBet = availableBalance >= MIN_BET;
  const maxBet = Math.max(0, Math.floor(availableBalance));
  const effectiveBet = canBet ? Math.min(maxBet, Math.max(MIN_BET, betAmount)) : MIN_BET;

  const handleVote = async (choice: "long" | "short") => {
    if (!canVote || !canBet) return;
    if (vote === choice && myBetAmount === effectiveBet) return;
    setVoteError(null);
    setVoteLoading(true);
    try {
      const res = await fetch("/api/sentiment/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice, bet_amount: effectiveBet }),
      });
      const json = await res.json();
      if (!json?.success) {
        setVoteError(json?.error?.message ?? "투표에 실패했습니다.");
        return;
      }
      const d = json.data;
      if (d) {
        setVote(choice);
        setMyBetAmount(d.bet_amount ?? effectiveBet);
        const longCoin = Number(d.long_coin_total ?? 0);
        const shortCoin = Number(d.short_coin_total ?? 0);
        const participantCount = (d.long_count ?? 0) + (d.short_count ?? 0);
        const { longPct: lp, shortPct: sp, coinLabel: cl, participantLabel: pl } = formatCoinRatio(longCoin, shortCoin, participantCount);
        setLongPct(lp);
        setShortPct(sp);
        setCoinLabel(cl);
        setParticipantLabel(pl);
      }
      await refetchUser();
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
      const res = await fetch("/api/sentiment/vote/cancel", { method: "POST" });
      const json = await res.json();
      if (!json?.success) {
        setVoteError(json?.error?.message ?? "취소에 실패했습니다.");
        return;
      }
      const d = json.data;
      if (d?.cancelled && d.long_coin_total != null) {
        setVote(null);
        setMyBetAmount(0);
        const { longPct: lp, shortPct: sp, coinLabel: cl, participantLabel: pl } = formatCoinRatio(
          Number(d.long_coin_total),
          Number(d.short_coin_total),
          (d.long_count ?? 0) + (d.short_count ?? 0)
        );
        setLongPct(lp);
        setShortPct(sp);
        setCoinLabel(cl);
        setParticipantLabel(pl);
      }
      await refetchUser();
    } catch {
      setVoteError("취소 요청에 실패했습니다.");
    } finally {
      setCancelLoading(false);
    }
  };

  const btcUsd = BTC_PRICE_PLACEHOLDER.usd;
  const btcKrw = BTC_PRICE_PLACEHOLDER.krw;

  return (
    <section
      className="rounded-xl border border-gray-500/40 bg-card/50 p-4 shadow-sm backdrop-blur-sm sm:p-5"
      aria-labelledby="human-indicator-heading"
    >
      <h2
        id="human-indicator-heading"
        className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        인간 지표
      </h2>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <p className="font-medium text-foreground sm:text-base">
          오늘 비트코인 가격, 방향을 어떻게 보시나요? (일봉 시가 vs 종가)
        </p>
        <span className="text-muted-foreground">
          오늘 00:00 시가 ${btcUsd} 한화로 약 {btcKrw}원
        </span>
        <span className="text-muted-foreground">
          | {VOTING_CLOSE_LABEL}
          {!voteOpen && (
            <span className="ml-1.5 font-medium text-amber-500">· 오늘 투표 마감</span>
          )}
        </span>
      </div>

      {/* 코인 수 비율 막대 */}
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

      {/* 마감 전 수정·취소 안내 */}
      {voteOpen && (
        <p className="mb-3 text-center text-xs text-muted-foreground">
          마감 전까지 수정 및 취소 가능합니다.
        </p>
      )}

      {/* 몇 코인 걸까? (로그인 + 마감 전) */}
      {canVote && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-foreground">몇 코인 걸까요?</p>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COINS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBetAmount(n)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  betAmount === n
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {n}코인
              </button>
            ))}
            <button
              type="button"
              onClick={() => setBetAmount(maxBet)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                betAmount === maxBet
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              전부 ({maxBet.toLocaleString()})
            </button>
            <input
              type="number"
              min={MIN_BET}
              max={maxBet >= MIN_BET ? maxBet : MIN_BET}
              value={betAmount}
              onChange={(e) =>
                setBetAmount(
                  Math.max(
                    MIN_BET,
                    Math.min(maxBet || MIN_BET, Number(e.target.value) || MIN_BET)
                  )
                )
              }
              className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm tabular-nums"
            />
            <span className="text-xs text-muted-foreground">
              코인 (가용: {availableBalance.toLocaleString()} / 최소 {MIN_BET}코인)
            </span>
          </div>
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
          disabled={!canVote || !canBet || voteLoading}
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
          disabled={!canVote || !canBet || voteLoading}
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

      {/* 배팅한 경우: N코인 걸었음 + 취소 버튼 */}
      {canVote && myBetAmount > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{myBetAmount.toLocaleString()}코인</span> 걸었습니다 ({vote === "long" ? "롱" : "숏"}).
          </span>
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelLoading}
            className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-60"
          >
            {cancelLoading ? "처리 중…" : "취소"}
          </button>
        </div>
      )}

      {!userLoading && (
        <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3 text-center text-sm">
          {user ? (
            <p className="font-medium text-foreground">
              <span>{user.nickname}</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span>보팅코인 {user.voting_coin_balance != null ? user.voting_coin_balance.toLocaleString() : "—"}코인</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span>롱 맞춘 확률: {accuracy.longPct != null ? `${accuracy.longPct}%` : "—"}</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span>숏 맞출 확률: {accuracy.shortPct != null ? `${accuracy.shortPct}%` : "—"}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              로그인한 사용자만 투표할 수 있어요. 로그인하면 투표 기록에 기반한 '투자 실력'을 확인할 수 있습니다!
              <span className="ml-3 inline-block align-middle">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  로그인
                </Link>
              </span>
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-center text-[10px] text-muted-foreground">
        통계적 참고용이며, 투자 권유가 아닙니다.
      </p>
    </section>
  );
}
