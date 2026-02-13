"use client";

/**
 * 랜딩 페이지 (비로그인 시 노출)
 *
 * - 도발적 문구로 플랫폼 강점 전달
 * - 조작 불가 예측, 돈이 걸린 포지션, 검증된 실력 이력서
 */

import Link from "next/link";
import { LogIn, UserPlus, Shield, CircleDollarSign, Trophy } from "lucide-react";

const HERO_LINE = "입으로만 떠드는 투자 전문가,";
const HERO_QUESTION = "아직도 믿으십니까?";
const TAGLINE_1 = "여기서 증명하면 진짜다.";
const TAGLINE_2 = "대한민국 리얼 트레이더들의 성지";
const SUB = "누적 승률, 누적 수익률도 숨김없이 보여주는 예측 시장";

const VALUE_PROPS = [
  {
    icon: CircleDollarSign,
    title: "돈이 걸린 포지션",
    desc: "말이 아니라 포인트가 걸린 투표식 예측 시장(정배/역배식 정산)",
  },
  {
    icon: Shield,
    title: "삭제·수정 불가",
    desc: "한 번 투표하면 영구 박제. 틀린 예측을 지울 수 없다.",
  },
  {
    icon: Trophy,
    title: "투자 실력 이력서",
    desc: "누적 승률 · 전적이 숫자로 고정.",
  },
] as const;

export function LandingSection() {
  return (
    <div className="relative w-full overflow-hidden">
      {/* 배경: 애니메이션 그라데이션 오브 */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="animate-gradient-float absolute -left-1/4 top-0 h-[500px] w-[600px] rounded-full bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(59,130,246,0.15),transparent_70%)]" />
        <div className="animate-gradient-float absolute -right-1/4 top-1/3 h-[400px] w-[500px] rounded-full bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(251,191,36,0.08),transparent_70%)]" style={{ animationDelay: "2s" }} />
        <div className="animate-gradient-float absolute bottom-0 left-1/2 h-[300px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_80%_40%_at_50%_100%,rgba(244,33,46,0.06),transparent_70%)]" style={{ animationDelay: "4s" }} />
        {/* 그리드 오버레이 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      {/* 히어로 */}
      <section className="mx-auto flex min-h-[75vh] max-w-5xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <p
          className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#fbbf24]/90 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}
        >
          실시간 예측 시장 VOTING MAN
        </p>
        <h1
          className="mb-4 max-w-4xl font-extrabold leading-tight tracking-tight text-[#f4212e] opacity-0 animate-hero-entrance"
          style={{ fontSize: "clamp(0.9375rem, 2.5vw + 0.75rem, 3.5rem)" }}
        >
          <span className="block whitespace-nowrap">{HERO_LINE}</span>
          <span className="mt-1 block whitespace-nowrap">{HERO_QUESTION}</span>
        </h1>
        <p
          className="mb-2 text-xl font-bold text-[#fbbf24] sm:text-2xl opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.35s", animationFillMode: "forwards" }}
        >
          <span className="block">{TAGLINE_1}</span>
          <span className="block">{TAGLINE_2}</span>
        </p>
        <p
          className="mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.5s", animationFillMode: "forwards" }}
        >
          {SUB}
        </p>

        {/* 왜 보팅맨인가 */}
        <div
          className="mb-10 w-full max-w-4xl opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.55s", animationFillMode: "forwards" }}
        >
          <h2 className="mb-6 text-center text-xl font-bold text-foreground sm:text-2xl">
            왜 보팅맨인가?
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-xl border border-border bg-background/80 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-[#3b82f6]/60 hover:bg-card/60 hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)]"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#3b82f6]/30 to-[#3b82f6]/10 text-[#3b82f6] transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="min-w-0 font-semibold text-foreground text-sm sm:text-base">{title}</h3>
                </div>
                <p className="text-xs text-muted-foreground sm:text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div
          className="flex flex-col gap-4 sm:flex-row opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.7s", animationFillMode: "forwards" }}
        >
                    <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#3b82f6] bg-[#3b82f6]/10 px-8 py-4 text-lg font-semibold text-[#3b82f6] transition-all duration-300 hover:scale-105 hover:bg-[#3b82f6]/20 hover:shadow-[0_0 30px_rgba(59,130,246,0.3)] active:scale-100"
          >
            <LogIn className="h-5 w-5" />
            로그인
          </Link>
          <Link
            href="/signup"
            className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-[#fbbf24] bg-[#fbbf24] px-8 py-4 text-lg font-bold text-black transition-all duration-300 hover:scale-105 hover:border-[#fbbf24] hover:shadow-[0_0_40px_rgba(251,191,36,0.5)] hover:shadow-[#fbbf24]/30 active:scale-100"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <UserPlus className="relative h-5 w-5" />
            <span className="relative">증명하기 (+10,000 VTC)</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
