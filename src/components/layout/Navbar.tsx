"use client";

/**
 * Navbar – 1차 MVP 상단 네비게이션
 *
 * 설계 의도:
 * - 좌측: 보팅맨(Votingman) 로고 + 비전
 * - 우측: 홈, 모의투자, 로그인/회원가입
 * - 모바일: 햄버거 메뉴
 * - Deep Dark 테마, 접근성 고려
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { Menu, X, LogIn, UserPlus, LogOut, User, ChevronDown, UserCircle, Pencil, UserX, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [ // 네비게이션 링크 — 투표(홈) → 리더보드 → 커뮤니티 → 모의 선물 투자 → 자동매매 → 버핏 원픽
  { href: "/home", label: "투표" },
  { href: "/leaderboard", label: "리더보드" },
  { href: "/community", label: "커뮤니티" },
  { href: "/simulation", label: "모의 선물 투자" },
  { href: "/verified-strategies", label: "자동매매" },
  { href: "/buffet-pick", label: "버핏 원픽" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; nickname: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // 닉네임 드롭다운: 바깥 클릭 시 닫기 (데스크톱)
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  // 모바일 프로필 드롭다운: 바깥 클릭 시 닫기
  useEffect(() => {
    if (!mobileUserMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(e.target as Node)) {
        setMobileUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileUserMenuOpen]);

  // 사용자 세션 확인
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      
      try {
        console.log('[Navbar] 🚀 Starting user load...');
        
        // 세션 확인
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('[Navbar] 📍 Session:', session?.user?.id, sessionError);
        
        if (!session?.user) {
          console.log('[Navbar] ❌ No session');
          setIsLoading(false);
          return;
        }
        
        

        // users 테이블 조회
        console.log('[Navbar] 🔍 Querying users table...');
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('nickname')
          .eq('user_id', session.user.id)
          .is('deleted_at', null)
          .single();  // maybeSingle 대신 single 사용
        
        console.log('[Navbar] 📊 Query result:', userData, userError);
        
        if (userError) {
          console.error('[Navbar] ❌ Query error:', userError);
          setIsLoading(false);
          return;
        }
        
        if (userData) {
          console.log('[Navbar] ✅ User found:', userData.nickname);
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            nickname: userData.nickname,
          });
        }
        
      } catch (err) {
        console.error('[Navbar] ❌ Error:', err);
      } finally {
        setIsLoading(false);
        console.log('[Navbar] ✅ Loading complete');
      }
    };
    
    loadUser();
  }, []);

  // 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      console.log('[Navbar] 🔴 Logout initiated');
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[Navbar] ❌ Logout error:', error);
        throw error;
      }
      
      console.log('[Navbar] ✅ Logout successful');
      setUser(null);
      closeMobile();
      
      // 페이지 새로고침하여 상태 완전 초기화
      window.location.href = '/';
    } catch (err) {
      console.error('[Navbar] ❌ Logout failed:', err);
      alert('로그아웃에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full min-h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <nav
          className="mx-auto flex h-14 min-h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
          aria-label="메인 네비게이션"
        >
          {/* 좌측: 로고 */}
          <div className="flex items-center gap-3 sm:gap-4">

            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
              onClick={closeMobile}
            >
              <Image
                src="/images/logo3.png"
                alt="보팅맨 로고"
                width={160}
                height={56}
                className="h-14 w-auto object-contain"
                priority
              />
            </Link>
          </div>

          {/* 우측: 데스크톱 메뉴 (524px 초과에서만 표시) */}
          <div className="hidden nav:flex nav:items-center nav:gap-6">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-sm px-2 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "text-foreground bg-muted/50"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </Link>
              );
            })}
            <div className="flex items-center gap-2 border-l border-border pl-4">
              {/* 디버그 텍스트 제거 */}
              {isLoading ? (
                <div className="h-8 w-20 animate-pulse rounded bg-muted" />
              ) : user ? (
                <>
                  <div className="relative flex items-center gap-2" ref={userMenuRef}>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen((o) => !o)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-expanded={userMenuOpen}
                      aria-haspopup="true"
                    >
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="max-w-[120px] truncate">{user.nickname}</span>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", userMenuOpen && "rotate-180")} />
                    </button>
                    {userMenuOpen && (
                      <div className="absolute right-0 top-full z-[100] mt-1.5 min-w-[180px] rounded-lg border border-border bg-popover py-1 shadow-md">
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
                          개인 정보 조회
                        </Link>
                        <Link
                          href="/profile/edit"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Pencil className="h-4 w-4 shrink-0" />
                          개인정보 수정
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
                    <span className="hidden lg:inline">로그아웃</span>
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-[#3b82f6] bg-[#3b82f6]/10 px-3 py-2 text-sm font-semibold text-[#3b82f6] transition-colors hover:bg-[#3b82f6]/20">
                      <LogIn className="h-4 w-4 shrink-0" />
                      <span>로그인</span>
                    </span>
                  </Link>
                  <Link href="/signup">
                    <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-[#fbbf24] bg-[#fbbf24]/15 px-3 py-2 text-sm font-semibold text-[#fbbf24] transition-colors hover:bg-[#fbbf24]/25">
                      <UserPlus className="h-4 w-4 shrink-0" />
                      <span>회원가입</span>
                      <span className="hidden rounded bg-[#fbbf24]/20 px-1.5 py-0.5 text-xs font-medium sm:inline">+10,000 VTC</span>
                    </span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* 모바일: 햄버거 버튼 (524px 이하) */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="nav:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </nav>

        {/* 모바일 메뉴 패널 (524px 이하) */}
        <div
          id="mobile-menu"
          role="dialog"
          aria-label="모바일 메뉴"
          className={cn(
            "nav:hidden overflow-hidden border-t border-border transition-all duration-200 ease-out",
            mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="flex flex-col gap-1 px-4 py-3">
            <div className="mb-2 flex gap-2">
              {isLoading ? (
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
              ) : user ? (
                <>
                  <div className="relative flex flex-1" ref={mobileUserMenuRef}>
                    <button
                      type="button"
                      onClick={() => setMobileUserMenuOpen((o) => !o)}
                      className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                      aria-expanded={mobileUserMenuOpen}
                      aria-haspopup="true"
                    >
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{user.nickname}</span>
                      <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform", mobileUserMenuOpen && "rotate-180")} />
                    </button>
                    {mobileUserMenuOpen && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover py-1 shadow-md">
                        <Link
                          href="/profile/stats"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                          onClick={() => { setMobileUserMenuOpen(false); closeMobile(); }}
                        >
                          <Trophy className="h-4 w-4 shrink-0" />
                          전적 및 승률 조회
                        </Link>
                        <Link
                          href="/profile"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                          onClick={() => { setMobileUserMenuOpen(false); closeMobile(); }}
                        >
                          <UserCircle className="h-4 w-4 shrink-0" />
                          개인 정보 조회
                        </Link>
                        <Link
                          href="/profile/edit"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                          onClick={() => { setMobileUserMenuOpen(false); closeMobile(); }}
                        >
                          <Pencil className="h-4 w-4 shrink-0" />
                          개인정보 수정
                        </Link>
                        <Link
                          href="/account/leave"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                          onClick={() => { setMobileUserMenuOpen(false); closeMobile(); }}
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
                    className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-rose-500/70 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="flex-1" onClick={closeMobile}>
                    <span className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#3b82f6] bg-[#3b82f6]/10 py-2.5 text-sm font-semibold text-[#3b82f6]">
                      <LogIn className="h-4 w-4 shrink-0" />
                      로그인
                    </span>
                  </Link>
                  <Link href="/signup" className="flex-1" onClick={closeMobile}>
                    <span className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#fbbf24] bg-[#fbbf24]/15 py-2.5 text-sm font-semibold text-[#fbbf24]">
                      <UserPlus className="h-4 w-4 shrink-0" />
                      회원가입
                      <span className="rounded bg-[#fbbf24]/20 px-1.5 py-0.5 text-xs font-medium">10,000 VTC</span>
                    </span>
                  </Link>
                </>
              )}
            </div>
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={closeMobile}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>
    </>
  );
}
