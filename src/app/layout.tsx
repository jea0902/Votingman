/**
 * 루트 레이아웃
 *
 * 설계 의도:
 * - 전역 폰트(Geist), 메타데이터, Navbar + Main + Footer 구조
 * - Deep Dark 고정이므로 html에 dark 불필요 (globals에서 :root가 이미 다크)
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar, Footer } from "@/components/layout";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased bg-background text-foreground`}
      >
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
