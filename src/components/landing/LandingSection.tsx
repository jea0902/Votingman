"use client";

/**
 * 랜딩 페이지 (비로그인 시 노출)
 *
 * - 스타트업 스타일 히어로: 그라디언트, 그리드, 오로라, 파티클
 * - 문구: 숫자로 증명하는 플랫폼, 대한민국 리얼 트레이더들의 플랫폼
 * - 하단: 왜 보팅맨인가? + 로그인/회원가입 CTA
 */
import styles from "./Hero.module.css";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { Shield, CircleDollarSign, Trophy, Play, ArrowRight } from "lucide-react";

const VALUE_PROPS = [
  {
    icon: CircleDollarSign,
    title: "돈이 걸린 포지션",
    desc: "포인트를 배팅하는 예측 시장",
  },
  {
    icon: Shield,
    title: "수정 불가",
    desc: "한번 투표하면 영구 박제",
  },
  {
    icon: Trophy,
    title: "투자 실력 이력서",
    desc: "누적 승률 · 전적 투명하게 공개",
  },
] as const;

export function LandingSection() {
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;
    const count = 28;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = styles.particle;
      const size = Math.random() * 3 + 1;
      const left = Math.random() * 100;
      const delay = Math.random() * 18;
      const dur = Math.random() * 14 + 10;
      const opacity = Math.random() * 0.5 + 0.15;
      p.setAttribute(
        "style",
        `width:${size}px;height:${size}px;left:${left}%;bottom:-10px;opacity:${opacity};animation-duration:${dur}s;animation-delay:${delay}s;`
      );
      container.appendChild(p);
    }
    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <div className="relative w-full">
      {/* ═══ 새 히어로 (스타트업 스타일) ═══ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 pb-24 pt-[120px]">
        {/* 배경 레이어 */}
        <div className={`${styles.heroBgBase} absolute inset-0 z-0`} aria-hidden />
        <div className={`${styles.heroNoise} pointer-events-none absolute inset-0 z-[1]`} aria-hidden />
        <div className={`${styles.heroGrid} pointer-events-none absolute inset-0 z-[1]`} aria-hidden />
        <div ref={particlesRef} className="pointer-events-none absolute inset-0 z-[1]" aria-hidden />
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] h-[200px] bg-gradient-to-b from-transparent to-[#0f1c2e]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-[3] h-[140px] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[rgba(96,165,250,0.7)] to-transparent"
          style={{ animation: "landing-glow-pulse 3s ease-in-out infinite" }}
        aria-hidden
        />

        {/* 콘텐츠 */}
        <div className="relative z-10 w-full max-w-[780px] text-center">
          {/* 뱃지 */}
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-[rgba(96,165,250,0.3)] bg-[rgba(37,99,235,0.15)] px-2 py-1.5 pl-2 pr-4 text-xs font-medium tracking-wide text-[#60a5fa] bg-[rgba(37,99,235,0.2)]"
            style={{ animation: "landing-fade-down 0.7s ease both" }}
          >
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[rgba(37,99,235,0.3)]">
              <ArrowRight className="h-3 w-3 text-[#60a5fa]" />
            </span>
            <span className="mr-1 inline-block h-[7px] w-[7px] rounded-full bg-[#34d399] shadow-[0_0_0_2px_rgba(52,211,153,0.3)]" style={{ animation: "landing-live-pip 1.6s ease-in-out infinite" }} />
            실시간 예측 시장 플랫폼 &nbsp;·&nbsp; 4개 마켓 운영 중
      </div>

          {/* 헤드라인 */}
          <h1
            className="mb-6 font-extrabold leading-none tracking-tight text-white"
            style={{
              fontFamily: "var(--font-geist-sans), Inter, 'Noto Sans KR', sans-serif",
              fontSize: "clamp(2.625rem, 6.5vw, 4.75rem)",
              letterSpacing: "-0.03em",
              animation: "landing-fade-up 0.7s 0.1s ease both",
            }}
          >
            <span className="mb-1 block font-extrabold tracking-tight opacity-90" style={{ letterSpacing: "-0.01em", fontSize: "0.88em" }}>
              말이 아닌 돈으로
            </span>
            <span
  className={`${styles.headlineGradient} block font-black`}
  style={{ letterSpacing: "-0.04em" }}
>
  SHOW & PROVE
</span>
        </h1>

          {/* 서브 카피 (수정된 문구) */}
          <p
            className="mx-auto mb-10 max-w-[480px] text-[17px] font-light leading-relaxed tracking-wide text-white/45"
            style={{ animation: "landing-fade-up 0.7s 0.2s ease both" }}
          >
            <strong className="font-semibold text-white/80">숫자로 증명하는, 리얼 트레이더들의 플랫폼</strong>
            <br />
            비트코인 방향 예측부터 고수 포지션 분석까지 —
            <br />
            데이터 기반의 투자 인사이트
          </p>

          {/* CTA */}
          <div
            className="mb-16 flex flex-wrap items-center justify-center gap-3"
            style={{ animation: "landing-fade-up 0.7s 0.3s ease both" }}
          >
            <Link
              href="/home"
              className="inline-flex items-center gap-2 rounded-xl border-0 bg-[#2563eb] px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset,0_8px_32px_rgba(37,99,235,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)_inset,0_16px_48px_rgba(37,99,235,0.55)]"
            >
              <Play className="h-4 w-4" />
              지금 투표하기
            </Link>
            <Link
              href="/pro-positions"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-[15px] font-medium text-white/75 bg-white/10  transition-all duration-200 hover:bg-white/10 hover:text-white hover:-translate-y-0.5"
            >
              실시간 고수 포지션
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* 스탯 카드 (베타: 미집계 항목은 0/계산중 표시) */}
          <div
            className="mx-auto max-w-[700px]"
            style={{ animation: "landing-fade-up 0.7s 0.4s ease both" }}
          >
            <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.07] backdrop-blur-xl sm:gap-3">
              {[
                { val: "0", showCoin: true, change: "집계 예정", label: "총 거래량 VTC" },
                { val: "계산중", change: "베타", label: "활성 참여자" },
                { val: "4", unit: "●", unitColor: "#34d399", change: "LIVE NOW", label: "라이브 마켓" },
                { val: "계산중", change: "베타", label: "예측 정확도" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="relative bg-white/[0.035] px-4 py-5 text-center transition-colors hover:bg-white/[0.06] sm:px-5 sm:py-6"
                >
                  <div className="mb-2 flex items-center justify-center gap-1.5 font-mono text-2xl font-semibold tracking-tight text-white">
                    {"showCoin" in item && item.showCoin && (
                      <span className="mr-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_0%,rgba(96,165,250,0.85),rgba(37,99,235,0.2))]">
                        <Image
                          src="/images/logo-coin.png"
                          alt="보팅맨 코인 로고"
                          width={20}
                          height={20}
                          className="h-4 w-4 object-contain"
                        />
                      </span>
                    )}
                    {"unit" in item && item.unit && item.unit !== "%" && (
                      <span
                        className="text-[13px] font-normal text-[#60a5fa]"
                        style={item.unitColor ? { color: item.unitColor } : undefined}
                      >
                        {item.unit}
                      </span>
                    )}
                    {item.val}
                    {"unit" in item && item.unit === "%" && (
                      <span className="ml-0.5 text-base font-normal text-white/50">%</span>
                    )}
                  </div>
                  <div className="mb-1.5 inline-flex items-center gap-0.5 rounded bg-[rgba(52,211,153,0.12)] px-1.5 py-0.5 font-mono text-[11px] text-[#34d399]">
                    {item.change}
                  </div>
                  <div className="text-[11.5px] font-normal uppercase tracking-wider text-white/35">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] font-bold tracking-wide text-white/40">
              베타 테스트중
            </p>
          </div>
        </div>

        {/* 스크롤 힌트 */}
        <div
          className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
          style={{ animation: "fade-in-up 1s 1s ease both" }}
        >
          <div className="flex h-9 w-6 items-start justify-center rounded-xl border-2 border-white/20 pt-1.5">
            <div className={`h-2 w-1 rounded-sm bg-white/50 ${styles.scrollWheel}`} />
          </div>
          <span className="text-[10px] tracking-[0.2em] text-white/25">scroll</span>
        </div>
      </section>

      {/* ═══ 왜 보팅맨인가? (스탯 박스 스타일 3등분) + 로그인/회원가입 ═══ */}
      <section className="relative z-10 border-t border-white/10 bg-[#0f1c2e] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-[700px]">
          <h2
            className="mb-6 text-center font-extrabold tracking-tight text-white"
            style={{
              fontFamily: "var(--font-geist-sans), Inter, 'Noto Sans KR', sans-serif",
              fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
              letterSpacing: "-0.01em",
            }}
          >
            왜 보팅맨이어야 하는가?
          </h2>
          <div className="mb-12 flex flex-col overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.035] backdrop-blur-xl sm:flex-row">
            {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="relative flex flex-1 flex-col border-b border-white/[0.07] px-5 py-6 text-center last:border-b-0 transition-colors hover:bg-white/[0.06] sm:border-b-0 sm:border-r sm:last:border-r-0"
              >
                <div className="mb-3 flex justify-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3b82f6]/30 text-[#3b82f6]">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="mb-2 font-semibold text-white text-sm sm:text-base">{title}</h3>
                <p className="text-[11.5px] leading-relaxed text-white/45 sm:text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
