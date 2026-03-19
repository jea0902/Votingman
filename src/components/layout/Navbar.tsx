"use client";

/**
 * Navbar – 2행 레이아웃 (Polymarket 스타일)
 *
 * 설계 의도:
 * - Row 1: 로고 | 유저/로그인 | 테마 토글
 * - Row 2: 탐색 탭 (가로 스크롤, 모바일 스와이프)
 * - Deep Dark 테마, 접근성 고려
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { LogIn, UserPlus, LogOut, User, ChevronDown, UserCircle, UserX, Trophy, Sun, Moon, Gift } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type NavLink = { href: string; label: string };

const NAV_LINKS: NavLink[] = [
  { href: "/home", label: "투표" },
  { href: "/simulation", label: "모의 투자" },
  { href: "/coin-market-sentiment", label: "코인 분위기" },
  { href: "/buffet-pick", label: "버핏 원픽" },
  { href: "/ai-analysis", label: "AI 분석" },
  { href: "/leaderboard", label: "보상" },
  { href: "/arbitrage", label: "아비트라지" },
  { href: "/vision", label: "비전" },
];

export function Navbar() {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; nickname: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;

    const handlePointerOutside = (e: Event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerOutside, true);
    document.addEventListener("click", handlePointerOutside, true);
    document.addEventListener("touchstart", handlePointerOutside, true);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerOutside, true);
      document.removeEventListener("click", handlePointerOutside, true);
      document.removeEventListener("touchstart", handlePointerOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  const loadUser = async () => {
    const supabase = createClient();
    try {
      console.log('[Navbar] loadUser 호출됨');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Navbar] 세션 확인:', { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        userId: session?.user?.id 
      });
      
      if (!session?.user) {
        console.log('[Navbar] 세션/사용자 없음 - null로 설정');
        setUser(null);
        setIsLoading(false);
        return;
      }
      const { data: userData, error } = await supabase
        .from("users")
        .select("nickname")
        .eq("user_id", session.user.id)
        .is("deleted_at", null)
        .single();

      if (!error && userData) {
        console.log('[Navbar] 사용자 로드 성공:', {
          id: session.user.id,
          email: session.user.email,
          nickname: userData.nickname
        });
        
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          nickname: userData.nickname,
        });
      } else {
        console.log('[Navbar] 사용자 로드 실패:', { error, userData, sessionUserId: session.user.id });
      }
    } catch (err) {
      console.error("[Navbar] Error loading user:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    const handler = () => loadUser();
    window.addEventListener("user-profile-updated", handler);
    return () => window.removeEventListener("user-profile-updated", handler);
  }, []);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      window.location.href = "/";
    } catch (err) {
      console.error("[Navbar] Logout failed:", err);
      alert("로그아웃에 실패했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <>
      {/* 모바일 상단 바 */}
      <header className="fixed left-0 right-0 top-0 z-[9999] border-b border-border bg-background/95 px-3 py-2 backdrop-blur-md md:hidden">
        <div className="mb-2 flex items-center justify-between">
          <Link
            href="/home"
            className="flex items-center gap-2 font-semibold text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
          >
            <Image
              src="/images/logo-light.png"
              alt="보팅맨 로고"
              width={120}
              height={40}
              className="h-9 w-auto object-contain dark:hidden"
              priority
            />
            <Image
              src="/images/logo-dark.png"
              alt="보팅맨 로고"
              width={120}
              height={40}
              className="hidden h-9 w-auto object-contain dark:block"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-border bg-muted/30 p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="다크 모드로 전환"
          >
            <Sun className="h-4 w-4 dark:hidden" aria-hidden />
            <Moon className="h-4 w-4 hidden dark:block" aria-hidden />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {NAV_LINKS.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/") ||
              (item.href === "/home" && pathname === "/");
            return (
              <Link
                key={`m-${item.href}`}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* 데스크탑 상단 헤더: 좌측 로고, 우측 알림/프로필/로그아웃/테마 */}
      <header className="fixed left-0 right-0 top-0 z-[9999] hidden h-20 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md md:flex">
        <Link
          href="/home"
          className="flex items-center gap-2 font-semibold text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
        >
          <Image
            src="/images/logo-light.png"
            alt="보팅맨 로고"
            width={150}
            height={50}
            className="h-14 w-auto object-contain dark:hidden"
            priority
          />
          <Image
            src="/images/logo-dark.png"
            alt="보팅맨 로고"
            width={150}
            height={50}
            className="hidden h-14 w-auto object-contain dark:block"
            priority
          />
        </Link>

        <div className="flex items-center gap-2">
          {user && <NotificationBell userId={user.id} />}

          {isLoading ? (
            <div className="h-9 w-24 animate-pulse rounded bg-muted" />
          ) : user ? (
            <>
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="max-w-[120px] truncate">{user.nickname}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", userMenuOpen && "rotate-180")} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full z-[9999] mt-1.5 min-w-[200px] rounded-lg border border-border bg-popover py-1 shadow-lg backdrop-blur-sm">
                    <Link
                      href="/profile/stats"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Trophy className="h-4 w-4 shrink-0" />
                      전적 및 승률 조회
                    </Link>
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <UserCircle className="h-4 w-4 shrink-0" />
                      개인정보 조회/수정
                    </Link>
                    <Link
                      href="/referral"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Gift className="h-4 w-4 shrink-0" />
                      레퍼럴
                    </Link>
                    <Link
                      href="/account/leave"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <UserX className="h-4 w-4 shrink-0" />
                      회원탈퇴
                    </Link>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-rose-500/70 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/login">
                <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-[#3b82f6] bg-[#3b82f6]/10 px-3 py-2 text-sm font-semibold text-[#3b82f6] transition-colors hover:bg-[#3b82f6]/20">
                  <LogIn className="h-4 w-4 shrink-0" />
                  로그인
                </span>
              </Link>
              <Link href="/signup">
                <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-amber-600 dark:border-[#fbbf24] bg-amber-100 dark:bg-[#fbbf24]/15 px-3 py-2 text-sm font-semibold text-amber-800 dark:text-[#fbbf24] transition-colors hover:bg-amber-200 dark:hover:bg-[#fbbf24]/25">
                  <UserPlus className="h-4 w-4 shrink-0" />
                  회원가입
                </span>
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/30 p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="다크 모드로 전환"
            title="다크 / 라이트 모드 전환"
          >
            <Sun className="h-4 w-4 dark:hidden" aria-hidden />
            <Moon className="h-4 w-4 hidden dark:block" aria-hidden />
          </button>
        </div>
      </header>

      {/* 데스크탑 좌측 세로 탭 */}
      <aside className="fixed bottom-0 left-0 top-20 z-[9998] hidden w-72 border-r border-border bg-background/95 backdrop-blur-md md:block">
        <div className="h-full overflow-y-auto p-3">
          <nav aria-label="메인 네비게이션" className="flex flex-col gap-1">
            {NAV_LINKS.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/") ||
                (item.href === "/home" && pathname === "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

    </>
  );
}