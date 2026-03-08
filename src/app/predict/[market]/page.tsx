"use client";

/**
 * 예측 시장 상세 페이지 (Polymarket 스타일)
 *
 * - 왼쪽: PRICE TO BEAT, CURRENT PRICE, TradingView 차트 (target 가격 표시), Rules 탭
 * - 오른쪽: 잔액, UP/DOWN 버튼, Amount, Trade 버튼
 * - 하단: 관련 시장 링크
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MarketIcon } from "@/components/market/MarketIcon";
import {
  isVotingOpenKST,
  getCloseTimeKstString,
  getLateVotingMultiplier,
  getLateVotingMultiplierLabel,
} from "@/lib/utils/sentiment-vote";
import {
  MARKET_LABEL,
  ACTIVE_MARKETS,
  isSentimentMarket,
  normalizeToDbMarket,
  MIN_BET_VTC,
} from "@/lib/constants/sentiment-markets";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";

const BtcChart = dynamic(
  () => import("@/components/predict/BtcChart").then((m) => ({ default: m.BtcChart })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span className="text-sm text-muted-foreground">차트 불러오는 중…</span>
      </div>
    ),
  }
);

const KospiChart = dynamic(
  () =>
    import("@/components/predict/KospiChart").then((m) => ({
      default: m.KospiChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span className="text-sm text-muted-foreground">차트 불러오는 중…</span>
      </div>
    ),
  }
);
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
import type { TodayResultItem } from "@/app/api/sentiment/polls/today-results/route";

const PERCENT_BUTTONS = [10, 25, 50, 75, 100] as const;
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
  btc_5m: "[5분 후] 비트코인 상승/하락",
  ndq: "나스닥100 상승/하락",
  sp500: "S&P 500 상승/하락",
  kospi: "코스피 상승/하락",
  kosdaq: "코스닥 상승/하락",
};

export default function PredictMarketPage() {
  const params = useParams();
  const marketParam = typeof params?.market === "string" ? params.market : "";
  const market = normalizeToDbMarket(marketParam || "btc_1d");

  const [poll, setPoll] = useState<(PollData & { 
    candle_start_at?: string;
    price_open?: number; 
    price_close?: number;
    settlement_status?: "open" | "closed" | "settling" | "settled";
    show_settled_complete?: boolean;
  }) | null>(null);
  const [user, setUser] = useState<{
    nickname: string;
    voting_coin_balance?: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"rules" | "context">("rules");
  const [betAmountInput, setBetAmountInput] = useState(stringifyBet(MIN_BET_VTC));
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [confirmingChoice, setConfirmingChoice] = useState<"long" | "short" | null>(null);
  const [mounted, setMounted] = useState(false);
  const [todayResults, setTodayResults] = useState<TodayResultItem[]>([]);
  const [todayResultsLoading, setTodayResultsLoading] = useState(false);
  const [todayResultsExpanded, setTodayResultsExpanded] = useState(false);
  const [todayResultsMaxVisible, setTodayResultsMaxVisible] = useState(5);
  const todayResultsContainerRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const prevVoteOpenRef = useRef<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** 1초마다 리렌더 → voteOpen/마감 문구가 정산·다음 투표 시각에 맞게 자동 전환 */
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /** 당일 결과 박스: 한 줄에 넘치지 않게 보여줄 개수 계산 (아이템 40px + gap 8px = 48px) */
  useEffect(() => {
    const el = todayResultsContainerRef.current;
    if (!el || todayResults.length === 0) return;
    const update = () => {
      const w = el.clientWidth;
      const count = Math.max(1, Math.floor(w / 48));
      setTodayResultsMaxVisible(count);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [todayResults.length]);

  // btc 시장: poll.settlement_status(btc_ohlc 기준)만 사용. 시간 계산 금지.
  const isBtcMarketForVote = ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"].includes(market);
  const voteOpen =
    isBtcMarketForVote && poll?.settlement_status !== undefined
      ? poll.settlement_status === "open"
      : isVotingOpenKST(market);
  const hasPollClosed =
    isBtcMarketForVote && poll?.settlement_status
      ? poll.settlement_status !== "open"
      : !voteOpen;
  const showClosedBox = (!voteOpen || hasPollClosed) && mounted;
  const isSettling =
    poll?.settlement_status === "settling" ||
    (poll?.settlement_status === "settled" && !poll?.show_settled_complete);
  const isSettledComplete = !!poll?.show_settled_complete;
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

  const fetchPoll = useCallback(async (opts?: { candle_start_at?: string }) => {
    try {
      const url =
        opts?.candle_start_at != null
          ? `/api/sentiment/poll?market=${market}&candle_start_at=${encodeURIComponent(opts.candle_start_at)}`
          : `/api/sentiment/poll?market=${market}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json?.success && json?.data) {
        const d = json.data;
        setPoll({
          market: d.market,
          poll_id: d.poll_id,
          candle_start_at: d.candle_start_at,
          long_count: d.long_count ?? 0,
          short_count: d.short_count ?? 0,
          long_coin_total: d.long_coin_total ?? 0,
          short_coin_total: d.short_coin_total ?? 0,
          my_vote: d.my_vote ?? null,
          price_open: d.price_open,
          price_close: d.price_close,
          settlement_status: d.settlement_status ?? "open",
          show_settled_complete: d.show_settled_complete ?? false,
        });
      }
    } catch {
      setPoll(null);
    }
  }, [market]);

  /** btc 계열 현재가 조회 (Binance 공개 API) */
  const isBtcMarket = ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"].includes(market);

  /** 코스피 시장: TradingView 차트 (KRX API 미승인으로 차트만 우선 구현) */
  const isKospiMarket = market === "kospi";
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

  /** 당일(KST) 정산된 폴 결과 (btc 시장만) */
  useEffect(() => {
    if (!isBtcMarket) return;
    let cancelled = false;
    setTodayResultsLoading(true);
    fetch(`/api/sentiment/polls/today-results?market=${market}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && Array.isArray(json?.data?.results)) {
          setTodayResults(json.data.results);
        }
      })
      .finally(() => {
        if (!cancelled) setTodayResultsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market, isBtcMarket]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  /** 투표 오픈 중: 다른 유저 베팅 실시간 반영 (3초마다 인원/코인 합계 갱신) */
  useEffect(() => {
    if (!poll || poll.settlement_status !== "open") return;
    const refetchCounts = () => {
      fetchPoll(
        poll.candle_start_at ? { candle_start_at: poll.candle_start_at } : undefined
      );
    };
    const intervalId = setInterval(refetchCounts, 3000);
    return () => clearInterval(intervalId);
  }, [poll?.poll_id, poll?.settlement_status, poll?.candle_start_at, fetchPoll]);

  /** 정산 상태 폴링 - 마감 후에만. show_settled_complete 전까지 주기 조회 (참여자는 알림 도착 시까지) */
  useEffect(() => {
    if (!poll || poll.show_settled_complete) return;
    if (poll.settlement_status === "open") return; // 마감 전: 정산 없음. 3초마다 인원/코인 갱신만 사용

    const pollSettlementStatus = () => {
      // 항상 현재 보는 폴 조회 (candle_start_at 전달). 새 폴로 바뀌는 것 방지
      const url = poll.candle_start_at
        ? `/api/sentiment/poll?market=${market}&candle_start_at=${encodeURIComponent(poll.candle_start_at)}`
        : `/api/sentiment/poll?market=${market}`;
      fetch(url)
        .then((res) => res.json())
        .then((json) => {
          if (json?.success && json?.data) {
            const d = json.data;
            setPoll(prevPoll => {
              if (!prevPoll) return null;
              return {
                ...prevPoll,
                settlement_status: d.settlement_status ?? "closed",
                show_settled_complete: d.show_settled_complete ?? false,
                price_close: d.price_close ?? prevPoll.price_close,
              };
            });
          }
        })
        .catch(() => {});
    };

    pollSettlementStatus(); // 즉시 1회 조회
    const intervalId = setInterval(pollSettlementStatus, 5000);
    return () => clearInterval(intervalId);
  }, [poll?.show_settled_complete, `${poll?.settlement_status ?? ""}-${poll?.candle_start_at ?? ""}`, market]);

  /** 마감↔오픈 전환 시 폴 재조회(새 round 데이터 반영) */
  useEffect(() => {
    if (prevVoteOpenRef.current === null) {
      prevVoteOpenRef.current = voteOpen;
      return;
    }
    if (prevVoteOpenRef.current !== voteOpen) {
      prevVoteOpenRef.current = voteOpen;
      // voteOpen true→false(마감): 현재 폴 유지(정산 대기). refetch 시 새 폴로 바뀌어 투표/VTC가 사라짐
      if (voteOpen) {
        fetchPoll();
        if (isBtcMarket) {
          setTodayResultsLoading(true);
          fetch(`/api/sentiment/polls/today-results?market=${market}`)
            .then((res) => res.json())
            .then((json) => {
              if (json?.success && Array.isArray(json?.data?.results)) {
                setTodayResults(json.data.results);
              }
            })
            .finally(() => setTodayResultsLoading(false));
        }
      }
    }
  }, [voteOpen, fetchPoll, market, isBtcMarket]);

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
  const multiplier = voteOpen ? getLateVotingMultiplier(market) : 1;
  const maxBase = multiplier > 0 ? Math.max(0, Math.floor(availableBalance / multiplier)) : 0;
  const maxBet = maxBase;
  const betNum = parseInt(betAmountInput, 10) || 0;
  const effectiveBet =
    betNum >= MIN_BET_VTC ? Math.min(maxBet, betNum) : 0;
  const chargeAmount = Math.ceil(effectiveBet * multiplier);
  const canSubmitBet =
    multiplier > 0 &&
    effectiveBet >= MIN_BET_VTC &&
    chargeAmount <= availableBalance;
  const canSubmitAdditional =
    isAdditionalMode &&
    multiplier > 0 &&
    effectiveBet >= MIN_BET_VTC &&
    chargeAmount <= balance;
  const canSubmitForChoice = (choice: "long" | "short") =>
    isAdditionalMode ? choice === vote && canSubmitAdditional : canSubmitBet;
  const insufficientBalance = effectiveBet >= MIN_BET_VTC && chargeAmount > availableBalance;
  const canVote = voteOpen && !hasPollClosed && !!user;
  const longPct =
    poll && (poll.long_coin_total ?? 0) + (poll.short_coin_total ?? 0) > 0
      ? Math.round(
          ((poll.long_coin_total ?? 0) /
            ((poll.long_coin_total ?? 0) + (poll.short_coin_total ?? 0))) *
            100
        )
      : 50;

  const handleVote = async (choice: "long" | "short") => {
    const totalCharge =
      isAdditionalMode && choice === vote ? myBetAmount + chargeAmount : chargeAmount;
    if (!canVote || !canSubmitForChoice(choice)) return;
    setVoteError(null);
    setVoteLoading(true);
    setConfirmingChoice(null);
    try {
      const res = await fetch("/api/sentiment/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market,
          poll_id: poll?.poll_id,
          choice,
          bet_amount: totalCharge,
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
    if (!canVote) return;
    if (myBetAmount > 0 && choice !== vote) return;
    if (insufficientBalance) {
      setVoteError(`잔액이 부족합니다. 프리미엄 포함 ${chargeAmount.toLocaleString()} VTC가 필요합니다.`);
      return;
    }
    if (!canSubmitForChoice(choice)) return;
    setVoteError(null);
    setConfirmingChoice(choice);
  };

  const relatedMarkets = ACTIVE_MARKETS.filter((m) => m !== market);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <MarketIcon market={market} size="default" showTimeframe />
            <div className="flex flex-col gap-0.5">
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                {mounted
                  ? voteOpen && !hasPollClosed
                    ? getCloseTimeKstString(market, poll?.candle_start_at)
                    : "마감"
                  : "\u00A0"}
              </p>
            </div>
          </div>
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
              <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-500">
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
            <div className="rounded-lg border border-border bg-card p-4">
              {voteOpen && !hasPollClosed ? (
                <>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    마감까지
                  </p>
                  <div className="mt-1">
                    <CountdownTimer market={market} candleStartAt={poll?.candle_start_at} />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    다음 투표
                  </p>
                  <div className="mt-1">
                    <Link
                      href={
                        ACTIVE_MARKETS.find((m) => m !== market && isVotingOpenKST(m))
                          ? `/predict/${ACTIVE_MARKETS.find((m) => m !== market && isVotingOpenKST(m))}`
                          : "/"
                      }
                      className="rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-500/30 dark:text-amber-500"
                    >
                      Go to Live Market
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {isBtcMarket ? (
              <BtcChart
                targetPrice={priceToBeat}
                defaultInterval="1m"
                className="min-h-[400px]"
              />
            ) : isKospiMarket ? (
              <KospiChart
                targetPrice={priceToBeat}
                defaultInterval="1d"
                className="min-h-[400px]"
              />
            ) : (
              <div className="flex h-[500px] items-center justify-center rounded-lg border-border bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  차트는 비트코인·코스피 시장에서 제공됩니다.
                </p>
              </div>
            )}
          </div>

          {isBtcMarket && (
            <div
              ref={todayResultsContainerRef}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="mb-2 text-xs text-muted-foreground">
                당일 결과 · 왼쪽일수록 최신
              </p>
              {todayResultsLoading ? (
                <p className="text-sm text-muted-foreground">불러오는 중…</p>
              ) : todayResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">오늘 정산된 결과가 없습니다.</p>
              ) : (
                <>
                  <div
                    className={`flex gap-2 ${todayResultsExpanded ? "overflow-x-auto scrollbar-hide pb-1" : ""}`}
                    style={todayResultsExpanded ? { flexWrap: "nowrap" } : undefined}
                  >
                    {(todayResultsExpanded
                      ? todayResults
                      : todayResults.slice(0, todayResultsMaxVisible)
                    ).map(
                      (r) => (
                        <div
                          key={r.candle_start_at}
                          className="flex shrink-0 items-center justify-center rounded-full border border-border w-10 h-10 text-lg"
                          style={{
                            backgroundColor:
                              r.outcome === "long"
                                ? "rgba(52, 211, 153, 0.2)"
                                : r.outcome === "short"
                                  ? "rgba(251, 113, 133, 0.2)"
                                  : "rgba(148, 163, 184, 0.2)",
                            color:
                              r.outcome === "long"
                                ? "rgb(52, 211, 153)"
                                : r.outcome === "short"
                                  ? "rgb(251, 113, 133)"
                                  : "rgb(148, 163, 184)",
                          }}
                          title={r.outcome === "long" ? "상승" : r.outcome === "short" ? "하락" : "동일가"}
                        >
                          {r.outcome === "long" ? "▲" : r.outcome === "short" ? "▼" : "−"}
                        </div>
                      )
                    )}
                  </div>
                  {todayResults.length > todayResultsMaxVisible && !todayResultsExpanded && (
                    <button
                      type="button"
                      onClick={() => setTodayResultsExpanded(true)}
                      className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-500 hover:underline"
                    >
                      더보기
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 2) 배팅 박스 (모바일: 차트 바로 아래, lg: 오른쪽) */}
        <div className="order-2 space-y-6">
          {showClosedBox && (
            <div className={`rounded-xl border-2 p-4 text-center ${
              isSettledComplete
                ? "border-emerald-500/40 bg-emerald-500/10" 
                : isSettling
                  ? "border-blue-500/40 bg-blue-500/10"
                  : "border-amber-500/40 bg-amber-500/10"
            }`}>
              <p className={`text-base font-semibold ${
                isSettledComplete
                  ? "text-emerald-700 dark:text-emerald-500" 
                  : isSettling
                    ? "text-blue-700 dark:text-blue-500"
                    : "text-amber-700 dark:text-amber-500"
              }`}>
                {isSettledComplete
                  ? "정산이 완료되었습니다." 
                  : isSettling
                    ? "정산 중입니다..."
                    : "이 투표는 마감되었습니다."}
              </p>
              {isSettling && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  정확한 정산을 위해 약 20초가 소요됩니다.
                </p>
              )}
              {(isSettledComplete || isSettling) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  결과는 프로필 &gt; 전적에서 확인할 수 있습니다.
                </p>
              )}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-400 dark:bg-amber-600 dark:text-amber-50 dark:hover:bg-amber-500"
              >
                Go to Live Market
              </button>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-4 text-sm font-medium text-foreground">
              잔액 :{" "}
              <span className="font-semibold text-amber-700 dark:text-amber-500">
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
                <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-500">
                  {getLateVotingMultiplierLabel(market)}
                </p>
                <p className="mb-2 text-sm font-medium text-foreground">
                  {isAdditionalMode ? "추가할 투표권 (기본 VTC)" : "Amount (기본 VTC)"}
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {PERCENT_BUTTONS.map((pct) => {
                    const val = Math.max(
                      MIN_BET_VTC,
                      Math.min(
                        maxBet,
                        Math.floor((maxBase * pct) / 100)
                      )
                    );
                    const isActive = betNum === val;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setBetAmountInput(stringifyBet(val))}
                        disabled={maxBase < MIN_BET_VTC}
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
                <div className="flex flex-col gap-1">
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
                    {multiplier > 1 && effectiveBet >= MIN_BET_VTC && (
                      <span className="text-xs text-muted-foreground">
                        → {chargeAmount.toLocaleString(FIXED_LOCALE)} VTC
                      </span>
                    )}
                  </div>
                  {insufficientBalance && (
                    <p className="text-xs font-medium text-destructive">
                      잔액 부족 (프리미엄 포함 {chargeAmount.toLocaleString()} VTC 필요)
                    </p>
                  )}
                </div>
              </>
            )}

            {!user && (
              <p className="mt-4 text-center text-sm text-destructive">
                <Link href="/login" className="text-destructive hover:underline font-semibold">
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
              <p className="mt-4 whitespace-pre-line text-center text-sm font-semibold text-amber-700 dark:text-amber-500">
                {`${vote === "long" ? "롱" : "숏"} ${myBetAmount.toLocaleString(FIXED_LOCALE)} VTC 투표 확정.\n추가 투표는 같은 선택으로만 가능`}
              </p>
            )}

            <Dialog open={confirmingChoice !== null} onOpenChange={(open) => !open && setConfirmingChoice(null)}>
              <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>투표 확정</DialogTitle>
                </DialogHeader>
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-500">
                  {multiplier > 1 ? (
                    <>프리미엄 포함 <strong>{chargeAmount.toLocaleString(FIXED_LOCALE)} VTC</strong>를 배팅하시겠습니까?</>
                  ) : (
                    <><strong>{chargeAmount.toLocaleString(FIXED_LOCALE)} VTC</strong>를 배팅하시겠습니까?</>
                  )}
                </p>
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
