/**
 * 루트 레이아웃
 *
 * 설계 의도:
 * - 전역 폰트(Geist), 메타데이터, Navbar + Main + Footer 구조
 * - 테마: 기본 다크, localStorage에 'light'일 때만 라이트.
 * - FOUC 해결: next/script 대신 <head> 인라인 스크립트 사용
 *   (next/script의 beforeInteractive는 모바일에서 늦게 실행되는 이슈 있음)
 */

import type { Metadata } from "next";
// ✅ next/script import 제거 (더 이상 사용 안 함)
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
  description: "보팅맨에서 데이터 기반 투자를 시작하세요.",
};

// ✅ 동일한 테마 스크립트 유지 (로직 변경 없음)
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
      {/* ✅ <head>에 인라인 스크립트 직접 삽입
           - next/script(beforeInteractive) 대신 이 방식 사용
           - React보다 무조건 먼저 실행되어 다크모드 깜빡임(FOUC) 완전 해결
           - 모바일에서도 새로고침 시 테마 유지됨 */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* ✅ <Script> 컴포넌트 제거 (위의 인라인 스크립트로 대체됨) */}

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