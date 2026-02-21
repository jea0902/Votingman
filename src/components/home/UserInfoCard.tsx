"use client";

/**
 * 홈 왼쪽 유저 정보 카드
 * - 비로그인: 카드 안에 로그인·회원가입 버튼
 * - 로그인: 닉네임, MMR, 승률, 전적
 */

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type RankMarketData = {
  market: string;
  season_win_count: number;
  season_total_count: number;
  win_rate: number;
  mmr: number;
  /** 해당 시장 내 상위 몇 % (0~100, 소수 둘째자리) */
  percentile_pct?: number | null;
  /** 해당 시장 내 실시간 순위 (1위, 2위, ...) */
  rank?: number | null;
};

type RankMeData = {
  season_id: string;
  markets: RankMarketData[];
};

async function fetchUserAndRank(): Promise<{
  user: { id: string; nickname: string; voting_coin_balance?: number } | null;
  rankData: RankMeData | null;
}> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return { user: null, rankData: null };
  }
  const { data: profile } = await supabase
    .from("users")
    .select("nickname, voting_coin_balance")
    .eq("user_id", session.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const user = {
    id: session.user.id,
    nickname: profile?.nickname ?? "유저",
    voting_coin_balance: profile?.voting_coin_balance != null ? Number(profile.voting_coin_balance) : undefined,
  };

  let rankData: RankMeData | null = null;
  try {
    const res = await fetch("/api/rank/me", { credentials: "include" });
    const json = await res.json();
    if (json?.success && json?.data) rankData = json.data;
  } catch {
    // ignore
  }
  return { user, rankData };
}

export function UserInfoCard() {
  const [user, setUser] = useState<{ id: string; nickname: string; voting_coin_balance?: number } | null>(null);
  const [rankData, setRankData] = useState<RankMeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchUserAndRank().then(({ user: u, rankData: r }) => {
      if (!cancelled) {
        setUser(u);
        setRankData(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 투표/취소 등으로 잔액이 바뀐 뒤 다른 컴포넌트가 발생시키는 이벤트 수신 시 갱신 */
  useEffect(() => {
    const handler = () => {
      fetchUserAndRank().then(({ user: u, rankData: r }) => {
        setUser(u);
        setRankData(r);
      });
    };
    window.addEventListener("user-balance-updated", handler);
    return () => window.removeEventListener("user-balance-updated", handler);
  }, []);

  if (loading) {
    return (
      <div className="w-full shrink-0 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="h-6 w-24 rounded bg-muted animate-pulse mb-4" />
        <div className="h-10 rounded bg-muted animate-pulse mb-2" />
        <div className="h-10 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  /** 대표 시장: 통합 랭킹(market='all') 한 개만 사용 */
  const rep =
    user && rankData?.markets?.length ? rankData.markets[0] ?? null : null;

  /** 통합 랭킹: market='all' 한 개만 표시 */
  const marketOrder = ["all"] as const;
  const marketMap = new Map(rankData?.markets?.map((m) => [m.market, m]) ?? []);

  return (
    <div className="w-full shrink-0 rounded-xl border border-border bg-card p-4 shadow-sm">
      {!user ? (
        <>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            랭크
          </div>
          <p className="mb-1.5 text-sm font-medium text-foreground">
            로그인하고 바로 이용하세요
          </p>
          <ul className="mb-4 list-none space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#3b82f6]">●</span>
              예측 투표에 참여할 수 있어요
            </li>
            <li className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#3b82f6]">●</span>
              MMR·승률로 내 실력을 확인해요
            </li>
          </ul>
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-[#3b82f6] bg-[#3b82f6]/10 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-[#3b82f6]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>1초 로그인</span>
              <span className="text-xs font-semibold text-[#3b82f6]">바로 예측 투표</span>
            </Link>
            <Link
              href="/signup"
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-amber-600 dark:border-[#fbbf24] bg-amber-50 dark:bg-[#fbbf24]/10 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-amber-100 dark:hover:bg-[#fbbf24]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>3초 회원가입</span>
              <span className="text-xs font-semibold text-amber-800 dark:text-[#fbbf24]">10,000 VTC 지급</span>
            </Link>
          </div>
        </>
      ) : (
        <>
          {/* 로그인 시: [순위] 닉네임 → 승률+전적 → 가용코인 → MMR/상위% */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {rep?.rank != null && (
                <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground lg:text-xs">
                  {rep.rank}위
                </span>
              )}
              <span className="min-w-0 truncate text-xs font-semibold text-foreground lg:text-sm" title={user?.nickname}>
                {user?.nickname ?? "—"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-[10px] lg:text-xs">
              <span className="text-foreground">
                승률 <span className="font-medium text-[#3b82f6]">
                  {rep && rep.season_total_count > 0
                    ? (rep.win_rate != null
                        ? Number(rep.win_rate).toFixed(1)
                        : ((rep.season_win_count / rep.season_total_count) * 100).toFixed(1))
                    : "0.0"}%
                </span>
              </span>
              <span className="text-muted-foreground">
                {rep ? `${rep.season_win_count}승 ${Math.max(0, rep.season_total_count - rep.season_win_count)}패` : "—"}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-500 lg:text-xs">
              가용 코인 수 : {user?.voting_coin_balance != null ? `${user.voting_coin_balance.toLocaleString()} VTC` : "—"}
            </span>
            <div className="w-fit min-w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-center">
              {marketOrder.map((key) => {
                const m = marketMap.get(key);
                const mmrText = m != null && typeof m.mmr === "number" ? `MMR ${m.mmr.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";
                const pctText = m?.percentile_pct != null ? ` · 상위 ${m.percentile_pct}%` : "";
                return (
                  <p key={key} className="text-[10px] font-semibold text-foreground lg:text-xs">{mmrText}{pctText}</p>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
