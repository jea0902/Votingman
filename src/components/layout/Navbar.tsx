"use client";

/**
 * Navbar – 1차 MVP 상단 네비게이션
 *
 * 설계 의도:
 * - 좌측: Bitcos 로고 + 비전
 * - 우측: 홈, 모의투자, 로그인/회원가입
 * - 모바일: 햄버거 메뉴
 * - Deep Dark 테마, 접근성 고려
 */

import Link from "next/link";
import { useState, useCallback } from "react";
import { Menu, X, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "홈" },
  { href: "/simulation", label: "모의투자" },
] as const;

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <nav
          className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
          aria-label="메인 네비게이션"
        >
          {/* 좌측: 로고 + 비전 */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
              onClick={closeMobile}
            >
              <span className="text-lg">Bitcos</span>
            </Link>

            <span className="hidden text-xs text-muted-foreground sm:inline-block lg:text-sm">
              투명한 데이터 분석으로 누구나 부자가 되게
            </span>
          </div>

          {/* 우측: 데스크톱 메뉴 + 로그인/회원가입 */}
          <div className="hidden md:flex md:items-center md:gap-6">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
              >
                {label}
              </Link>
            ))}
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLoginOpen(true)}
                className="gap-1"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden lg:inline">로그인</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setSignupOpen(true)}
                className="gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden lg:inline">회원가입</span>
              </Button>
            </div>
          </div>

          {/* 모바일: 햄버거 버튼 */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </nav>

        {/* 모바일 메뉴 패널 */}
        <div
          id="mobile-menu"
          role="dialog"
          aria-label="모바일 메뉴"
          className={cn(
            "md:hidden overflow-hidden border-t border-border transition-all duration-200 ease-out",
            mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="flex flex-col gap-1 px-4 py-3">
            <div className="mb-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoginOpen(true);
                  closeMobile();
                }}
                className="flex-1 justify-start gap-2"
              >
                <LogIn className="h-4 w-4" />
                로그인
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setSignupOpen(true);
                  closeMobile();
                }}
                className="flex-1 justify-start gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <UserPlus className="h-4 w-4" />
                회원가입
              </Button>
            </div>
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:outline-none"
                onClick={closeMobile}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* 로그인 모달 */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>로그인</DialogTitle>
            <DialogDescription>
              이메일과 비밀번호를 입력하세요. (준비 중)
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            로그인 기능은 곧 제공됩니다.
          </div>
        </DialogContent>
      </Dialog>

      {/* 회원가입 모달 */}
      <Dialog open={signupOpen} onOpenChange={setSignupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>회원가입</DialogTitle>
            <DialogDescription>
              새 계정을 만드세요. (준비 중)
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            회원가입 기능은 곧 제공됩니다.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
