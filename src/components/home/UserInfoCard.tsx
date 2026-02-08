"use client";

/**
 * 홈 왼쪽 유저 정보 카드 (lol.ps 스타일 참고)
 * - 비로그인: 카드 안에 로그인·회원가입 버튼
 * - 로그인: 시즌 랭크 + 닉네임, 티어 로고, MMR, 승률, 전적, 일별 MMR 추이
 */

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** API tier 값 → public/images/tier_logos 파일명 (beginer = 배치 미완료) */
const TIER_LOGO: Record<string, string> = {
  gold: "/images/tier_logos/gold_tier.png",
  platinum: "/images/tier_logos/platinum_tier.png",
  diamond: "/images/tier_logos/dia_tier.png",
  master: "/images/tier_logos/master_tier.png",
  challenger: "/images/tier_logos/challenger_tier.png",
};
const TIER_LOGO_BEGINER = "/images/tier_logos/beginer_tier.png";

const TIER_LABEL: Record<string, string> = {
  gold: "골드",
  platinum: "플레티넘",
  diamond: "다이아",
  master: "마스터",
  challenger: "챌린저",
};

/** 티어 높은 순 (대표 티어 선택용) */
const TIER_RANK: Record<string, number> = {
  challenger: 5,
  master: 4,
  diamond: 3,
  platinum: 2,
  gold: 1,
};

/** 시장 라벨 (통합 랭킹: market='all'만 사용) */
const MARKET_LABEL: Record<string, string> = {
  all: "통합",
  btc: "비트코인",
  us: "미국 주식",
  kr: "한국 주식",
};

/** season_id "2025-1" → "2025 1시즌 랭크" */
function formatSeasonLabel(seasonId: string): string {
  const [y, q] = seasonId.split("-");
  return y && q ? `${y} ${q}시즌 랭크` : "시즌 랭크";
}

/** 비로그인 시 표시용: 현재 연도·시즌(1~4분기) 랭크 라벨 */
function getCurrentSeasonLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3) as 1 | 2 | 3 | 4;
  return `${year} ${quarter}시즌 랭크`;
}

type TierMarketData = {
  market: string;
  placement_matches_played: number;
  placement_done: boolean;
  season_win_count: number;
  season_total_count: number;
  win_rate: number;
  mmr: number;
  tier: string | null;
  /** 배치 완료 시 해당 시장 내 상위 몇 % (0~100, 소수 둘째자리) */
  percentile_pct?: number | null;
};

type TierMeData = {
  season_id: string;
  markets: TierMarketData[];
};

async function fetchUserAndTier(): Promise<{
  user: { id: string; nickname: string; voting_coin_balance?: number } | null;
  tierData: TierMeData | null;
}> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return { user: null, tierData: null };
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

  let tierData: TierMeData | null = null;
  try {
    const res = await fetch("/api/tier/me", { credentials: "include" });
    const json = await res.json();
    if (json?.success && json?.data) tierData = json.data;
  } catch {
    // ignore
  }
  return { user, tierData };
}

export function UserInfoCard() {
  const [user, setUser] = useState<{ id: string; nickname: string; voting_coin_balance?: number } | null>(null);
  const [tierData, setTierData] = useState<TierMeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchUserAndTier().then(({ user: u, tierData: t }) => {
      if (!cancelled) {
        setUser(u);
        setTierData(t);
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
      fetchUserAndTier().then(({ user: u, tierData: t }) => {
        setUser(u);
        setTierData(t);
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
    user && tierData?.markets?.length ? tierData.markets[0] ?? null : null;
  const seasonLabel = tierData?.season_id ? formatSeasonLabel(tierData.season_id) : "시즌 랭크";
  const tierName = rep ? (!rep.placement_done || !rep.tier ? "배치 진행 중" : (TIER_LABEL[rep.tier ?? ""] ?? rep.tier ?? "—")) : "—";

  /** 통합 랭킹: market='all' 한 개만 표시 */
  const marketOrder = ["all"] as const;
  const marketMap = new Map(tierData?.markets?.map((m) => [m.market, m]) ?? []);

  return (
    <div className="w-full shrink-0 rounded-xl border border-border bg-card p-4 shadow-sm">
      {!user ? (
        <>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {getCurrentSeasonLabel()}
          </div>
          <p className="mb-1.5 text-sm font-medium text-foreground">
            로그인하고 바로 이용하세요
          </p>
          <ul className="mb-4 list-none space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#3b82f6]">●</span>
              예측 배팅에 참여할 수 있어요
            </li>
            <li className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#3b82f6]">●</span>
              티어·MMR·승률로 내 실력을 확인해요
            </li>
          </ul>
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-[#3b82f6] bg-[#3b82f6]/10 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-[#3b82f6]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>1초 로그인</span>
              <span className="text-xs font-semibold text-[#3b82f6]">바로 예측 배팅</span>
            </Link>
            <Link
              href="/signup"
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-[#fbbf24] bg-[#fbbf24]/10 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-[#fbbf24]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>3초 회원가입</span>
              <span className="text-xs font-semibold text-[#fbbf24]">10,000 VTC 지급</span>
            </Link>
          </div>
        </>
      ) : (
        <>
          {/* 로그인 시: 시즌 랭크 → 티어+닉네임 → 승률+전적 → 가용코인 → 통합 박스 */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:text-xs">
              {seasonLabel}
            </span>
            <div className="flex items-center gap-2">
              <div className="relative h-9 w-9 shrink-0 lg:h-10 lg:w-10">
                <Image
                  src={rep?.placement_done && rep?.tier ? (TIER_LOGO[rep.tier] ?? TIER_LOGO_BEGINER) : TIER_LOGO_BEGINER}
                  alt={tierName}
                  width={40}
                  height={40}
                  className="h-9 w-9 object-contain lg:h-10 lg:w-10"
                />
              </div>
              <span className="min-w-0 truncate text-xs font-semibold text-foreground lg:text-sm" title={user?.nickname}>
                {user?.nickname ?? "—"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-[10px] lg:text-xs">
              <span className="text-foreground">
                승률 <span className="font-medium text-[#3b82f6]">
                  {rep && rep.season_total_count > 0 ? ((rep.win_rate ?? rep.season_win_count / rep.season_total_count) * 100).toFixed(1) : "0.0"}%
                </span>
              </span>
              <span className="text-muted-foreground">
                {rep ? `${rep.season_win_count}승 ${Math.max(0, rep.season_total_count - rep.season_win_count)}패` : "—"}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-amber-500 lg:text-xs">
              가용 코인 수 : {user?.voting_coin_balance != null ? `${user.voting_coin_balance.toLocaleString()} VTC` : "—"}
            </span>
            <div className="w-fit min-w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-center">
              {marketOrder.map((key) => {
                const m = marketMap.get(key);
                const isBeginer = !m || !m.placement_done || !m.tier;
                const displayText = isBeginer
                  ? `배치 ${m?.placement_matches_played ?? 0}/5`
                  : (TIER_LABEL[m!.tier ?? ""] ?? m!.tier ?? "—");
                return (
                  <p key={key} className="text-[10px] font-semibold text-foreground lg:text-xs">{displayText}</p>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
