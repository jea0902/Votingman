"use client";

/**
 * HumanIndicatorSection – 인간 지표 (데일리 롱/숏 투표)
 *
 * 설계 의도:
 * - 보자마자 클릭 유도: 한 문장 질문 + 롱/숏 두 개의 큰 버튼만 노출
 * - 투표 허용: KST 00:00 ~ 22:30, 마감 시각 표기 및 마감 후 투표 불가
 * - 비로그인: 쿠키 방식 허용. 회원가입 유도 문구 투표 전 항시 표시
 * - 로그인: "닉네임 | 롱 맞춘 확률: xx% | 숏 맞출 확률: yy%" 구분 표시
 * - 오늘 00:00 KST 시가: 달러 소수점 둘째자리 + 한화 표기 (추후 API 연동)
 */

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isVotingOpenKST } from "@/lib/utils/sentiment-vote";
import { Button, buttonVariants } from "@/components/ui/button";

type VoteChoice = "long" | "short" | null;

/** 오늘 00:00 KST 시가 플레이스홀더 (추후 API 연동, 달러 소수점 둘째자리 + 한화) */
const BTC_PRICE_PLACEHOLDER = { usd: "—", krw: "—" };

export function HumanIndicatorSection() {
  const [vote, setVote] = useState<VoteChoice>(null);
  const [longPct, setLongPct] = useState(62);
  const [shortPct, setShortPct] = useState(38);
  const [totalLabel, setTotalLabel] = useState("1,234명 참여");
  const [voteOpen, setVoteOpen] = useState(() => isVotingOpenKST());
  const [user, setUser] = useState<{ nickname: string } | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [accuracy, setAccuracy] = useState<{
    longPct: number | null;
    shortPct: number | null;
  }>({ longPct: null, shortPct: null });

  useEffect(() => {
    setVoteOpen(isVotingOpenKST());
    const interval = setInterval(() => setVoteOpen(isVotingOpenKST()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setUserLoading(false);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("nickname")
        .eq("user_id", session.user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (data) setUser({ nickname: data.nickname });
      // TODO: 맞출 확률 API 연동 시 setAccuracy({ longPct: xx, shortPct: yy })
      setUserLoading(false);
    });
  }, []);

  const handleVote = (choice: "long" | "short") => {
    if (!voteOpen) return;
    // 같은 버튼 두 번 누르면 무시 (취소 안 함)
    if (vote === choice) return;
    const prev = vote;
    setVote(choice);
    if (prev === null) {
      // 첫 투표
      if (choice === "long") {
        setLongPct((p) => Math.min(100, p + 1));
        setShortPct((p) => Math.max(0, p - 1));
      } else {
        setShortPct((p) => Math.min(100, p + 1));
        setLongPct((p) => Math.max(0, p - 1));
      }
    } else {
      // 다른 버튼으로 수정: 이전 선택 -1, 새 선택 +1
      if (choice === "long") {
        setLongPct((p) => Math.min(100, p + 1));
        setShortPct((p) => Math.max(0, p - 1));
      } else {
        setShortPct((p) => Math.min(100, p + 1));
        setLongPct((p) => Math.max(0, p - 1));
      }
    }
    setTotalLabel("1,235명 참여");
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

      {/* 질문 + 오늘 00:00 시가 + 마감 시각 한 줄 */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <p className="font-medium text-foreground sm:text-base">
          오늘 비트코인 가격, 방향을 어떻게 보시나요?
        </p>
        <span className="text-muted-foreground">
          오늘 00:00 시가 ${btcUsd} (약 {btcKrw}원)
        </span>
        <span className="text-muted-foreground">
          | 투표 마감 시각 22:30
          {!voteOpen && (
            <span className="ml-1.5 font-medium text-amber-500">
              · 오늘 투표 마감
            </span>
          )}
        </span>
      </div>

      {/* 현재 비율 막대 */}
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
        <p className="mt-1.5 text-xs text-muted-foreground">{totalLabel}</p>
      </div>

      {/* 롱/숏 버튼 (마감 시 비활성화) */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handleVote("long")}
          disabled={!voteOpen}
          className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border-2 py-4 text-emerald-400 transition-all focus:visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ${
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
          disabled={!voteOpen}
          className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border-2 py-4 text-rose-400 transition-all focus:visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ${
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

      {/* 회원가입 유도 (비로그인 시 항시) / 로그인 시 닉네임 | 롱/숏 맞춘·맞출 확률 */}
      {!userLoading && (
        <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3 text-center text-sm">
          {user ? (
            <p className="font-medium text-foreground">
              <span>{user.nickname}</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span>롱 맞춘 확률: {accuracy.longPct != null ? `${accuracy.longPct}%` : "—"}</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span>숏 맞출 확률: {accuracy.shortPct != null ? `${accuracy.shortPct}%` : "—"}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              로그인하고 투표하시면, 투표 기록이 저장되어 내가 맞춘 확률을 볼
              수 있어요.
              <span className="ml-3 inline-block">
                <Link
                  href="/login"
                  className={buttonVariants({ size: "sm", variant: "default" })}
                >
                  로그인
                </Link>
              </span>
            </p>
          )}
        </div>
      )}

      {/* 면책 조항: 섹션 하단 작은 글씨 한 줄 (확정) */}
      <p className="mt-4 text-center text-[10px] text-muted-foreground">
        통계적 참고용이며, 투자 권유가 아닙니다.
      </p>
    </section>
  );
}
