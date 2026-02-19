/**
 * 루트 레이아웃
 *
 * 설계 의도:
 * - 전역 폰트(Geist), 메타데이터, Navbar + Main + Footer 구조
 * - 테마: 기본 다크, localStorage에 'light'일 때만 라이트. (첫 페인트 전 스크립트로 설정)
 */

import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar, Footer, HeartbeatProvider, PageViewTracker } from "@/components/layout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "보팅맨 | 탈중앙화 예측 배팅 플랫폼",
  description:
    "보팅맨에서 데이터 기반 투자를 시작하세요.",
};

const THEME_SCRIPT = `
(function(){
  var t = localStorage.getItem('theme');
  if (t === 'light') document.documentElement.classList.remove('dark');
  else document.documentElement.classList.add('dark');
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        {/* 전역 배경: 랜딩과 동일한 그리드 (다크 모드에서만) */}
        <div
          className="fixed inset-0 -z-10 hidden opacity-40 dark:block"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.032) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.032) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 80%)",
            maskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 80%)",
          }}
          aria-hidden
        />

        {/* main에 flex-1 없음 → main 높이 = 콘텐츠 높이 → 문서 전체 스크롤. flex-1이면 main을 스크롤 가두는 게 아니라 남은 공간을 채우는 거 */}
        <div className="flex min-h-screen flex-col">
          <HeartbeatProvider />
          <PageViewTracker />
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
