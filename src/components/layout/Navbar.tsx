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
import { LogIn, UserPlus, LogOut, User, ChevronDown, UserCircle, UserX, Trophy, Sun, Moon, Gift, TrendingUp, Brain, Zap } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type NavLink =
  | { href: string; label: string; hasDropdown?: never; subItems?: never }
  | {
    label: string;
    hasDropdown: true;
    subItems: Array<{ href: string; label: string; icon: any }>;
    href?: never;
  };

const NAV_LINKS: NavLink[] = [
  { href: "/home", label: "투표" },
  { href: "/simulation", label: "모의 투자" },
  {
    label: "뉴스",
    hasDropdown: true,
    subItems: [
      { href: "/breaking-news", label: "속보", icon: Zap },
      { href: "/coin-market-sentiment", label: "코인 분위기", icon: TrendingUp },
      { href: "/buffet-pick", label: "버핏 원픽", icon: Brain },
    ]
  },
  { href: "/ai-analysis", label: "AI 분석" },
  { href: "/leaderboard", label: "보상" },
  { href: "/arbitrage", label: "아비트라지" },
  { href: "/community", label: "건의" },
];

export function Navbar() {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [newsMenuOpen, setNewsMenuOpen] = useState(false);
  const [newsMenuPosition, setNewsMenuPosition] = useState({ top: 0, left: 0 });
  const [user, setUser] = useState<{ id: string; email: string; nickname: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const newsMenuRef = useRef<HTMLDivElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    const updateScrollHint = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    };
    updateScrollHint();
    el.addEventListener("scroll", updateScrollHint);
    const ro = new ResizeObserver(updateScrollHint);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollHint);
      ro.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen && !newsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (newsMenuRef.current && !newsMenuRef.current.contains(e.target as Node)) {
        setNewsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen, newsMenuOpen]);

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

  // 뉴스 메뉴 위치 계산
  useEffect(() => {
    if (newsMenuOpen && newsMenuRef.current) {
      const rect = newsMenuRef.current.getBoundingClientRect();
      setNewsMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
      console.log('드롭다운 위치 계산됨:', { top: rect.bottom + 4, left: rect.left });
    }
  }, [newsMenuOpen]);

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
    <header className="sticky top-0 z-[9998] w-full border-b border-border bg-background/95 backdrop-blur-md">
      <nav className="flex flex-col" aria-label="메인 네비게이션">
        {/* Row 1: 로고 | 유저 + 테마 */}
        <div className="mx-auto flex h-14 min-h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/landing"
            className="flex items-center gap-2 font-semibold text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm shrink-0"
          >
            <Image
              src="/images/logo-light.png"
              alt="보팅맨 로고"
              width={160}
              height={56}
              className="h-12 w-auto object-contain sm:h-14 dark:hidden"
              priority
            />
            <Image
              src="/images/logo-dark.png"
              alt="보팅맨 로고"
              width={160}
              height={56}
              className="hidden h-12 w-auto object-contain sm:h-14 dark:block"
              priority
            />
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            ) : user ? (
              <>
                {/* 알림 종 */}
                <NotificationBell userId={user.id} />
                
                <div className="relative flex items-center gap-2" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1.5 sm:px-3 sm:py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="max-w-[100px] truncate sm:max-w-[120px]">{user.nickname}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", userMenuOpen && "rotate-180")} />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full z-[9999] mt-1.5 min-w-[180px] rounded-lg border border-border bg-popover py-1 shadow-lg backdrop-blur-sm">
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
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-rose-500/70 bg-rose-500/10 px-2 py-1.5 sm:px-3 sm:py-2 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-[#3b82f6] bg-[#3b82f6]/10 px-2 py-1.5 sm:px-3 sm:py-2 text-sm font-semibold text-[#3b82f6] transition-colors hover:bg-[#3b82f6]/20">
                    <LogIn className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">로그인</span>
                  </span>
                </Link>
                <Link href="/signup">
                  <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-amber-600 dark:border-[#fbbf24] bg-amber-100 dark:bg-[#fbbf24]/15 px-2 py-1.5 sm:px-3 sm:py-2 text-sm font-semibold text-amber-800 dark:text-[#fbbf24] transition-colors hover:bg-amber-200 dark:hover:bg-[#fbbf24]/25">
                    <UserPlus className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">회원가입</span>
                    <span className="hidden rounded bg-amber-200 dark:bg-[#fbbf24]/20 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-[#fbbf24] sm:inline">+10,000 VTC</span>
                  </span>
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-border bg-muted/30 p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="다크 모드로 전환"
              title="다크 / 라이트 모드 전환"
            >
              <Sun className="h-4 w-4 dark:hidden" aria-hidden />
              <Moon className="h-4 w-4 hidden dark:block" aria-hidden />
            </button>
          </div>
        </div>

        {/* Row 2: 탭 */}
        <div className="relative bg-background overflow-visible">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 overflow-visible">
            <div className="relative overflow-visible">
              <div
                className={cn(
                  "pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-10 shrink-0 bg-gradient-to-r from-background via-background/95 to-transparent transition-opacity duration-200 sm:w-14",
                  canScrollLeft ? "opacity-100" : "opacity-0"
                )}
                aria-hidden
              />
              <div
                className={cn(
                  "pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-10 shrink-0 bg-gradient-to-l from-background via-background/95 to-transparent transition-opacity duration-200 sm:w-14",
                  canScrollRight ? "opacity-100" : "opacity-0"
                )}
                aria-hidden
              />
              <div
                ref={tabScrollRef}
                className="overflow-x-auto overflow-y-visible scrollbar-hide -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
                style={{ overflowY: 'visible' }}
              >
                <div className="flex items-center gap-2 py-2 flex-nowrap min-w-max sm:gap-4 lg:gap-6">
                  {NAV_LINKS.map((item, index) => {
                    if (item.hasDropdown && item.subItems) {
                      // 뉴스 드롭다운 메뉴
                      const isNewsActive = item.subItems.some(sub =>
                        pathname === sub.href || pathname.startsWith(sub.href + "/")
                      );
                      return (
                        <div key={`dropdown-${index}`} className="relative z-[9999]" ref={newsMenuRef}>
                          <button
                            type="button"
                            onClick={() => {
                              const newState = !newsMenuOpen;
                              console.log('뉴스 버튼 클릭됨, 변경될 상태:', newState);
                              setNewsMenuOpen(newState);
                            }}
                            className={cn(
                              "flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background shrink-0",
                              isNewsActive
                                ? "text-foreground bg-muted/80"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                            aria-expanded={newsMenuOpen}
                            aria-haspopup="true"
                          >
                            {item.label}
                            <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", newsMenuOpen && "rotate-180")} />
                          </button>
                          {newsMenuOpen && (
                            <div
                              className="min-w-[160px] rounded-lg border border-border py-1 shadow-lg"
                              style={{
                                position: 'fixed',
                                zIndex: 2147483647,
                                top: `${newsMenuPosition.top}px`,
                                left: `${newsMenuPosition.left}px`,
                                backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : 'white',
                                color: document.documentElement.classList.contains('dark') ? 'white' : 'black'
                              }}
                            >
                              {item.subItems.map((subItem) => (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted"
                                  style={{
                                    color: document.documentElement.classList.contains('dark') ? 'white' : 'black'
                                  }}
                                  onClick={() => setNewsMenuOpen(false)}
                                >
                                  <subItem.icon className="h-4 w-4 shrink-0" />
                                  {subItem.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      // 일반 링크
                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/") ||
                        (item.href === "/home" && pathname === "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "whitespace-nowrap rounded-sm px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background shrink-0",
                            isActive
                              ? "text-foreground bg-muted/80"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    }
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}