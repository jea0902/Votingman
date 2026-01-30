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
import { useState, useCallback, useEffect } from "react";
import { Menu, X, LogIn, UserPlus, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [ // 네비게이션 링크
  { href: "/", label: "홈" },
  { href: "/verified-strategies", label: "검증된 매매법" },
  { href: "/research-lab", label: "매매법 연구소" },
  { href: "/buffet-pick", label: "버핏원픽" },
  { href: "/simulation", label: "모의 선물 투자" },
  { href: "/community", label: "커뮤니티" },
] as const;

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; nickname: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string>('');
  const [hasSession, setHasSession] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // 사용자 세션 확인
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // 타임아웃 설정 (3초 후 강제 로딩 해제)
    const timeout = setTimeout(() => {
      console.log('[Navbar] ⚠️ Loading timeout - forcing isLoading to false');
      if (mounted) setIsLoading(false);
    }, 3000);

    // 초기 세션 확인
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      console.log('[Navbar] 🔍 Initial session check:', session?.user?.id, error);
      
      try {
        if (session?.user) {
          setSessionId(session.user.id);
          setHasSession(true);
          console.log('[Navbar] 📝 Fetching user from users table...');
          
          // users 테이블에서 닉네임 가져오기
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('nickname')
            .eq('user_id', session.user.id)
            .is('deleted_at', null)
            .maybeSingle();

          console.log('[Navbar] 📊 User data result:', userData, userError);
          
          if (userData && mounted) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              nickname: userData.nickname,
            });
            console.log('[Navbar] ✅ User loaded:', userData.nickname);
          } else {
            console.log('[Navbar] ⚠️ Session exists but no user data - redirecting to signup');
            // Session은 있지만 users 테이블에 데이터가 없음 → 닉네임 입력 필요
            if (mounted && typeof window !== 'undefined') {
              window.location.href = '/signup?step=nickname';
            }
          }
        } else {
          console.log('[Navbar] ℹ️ No session found');
          setHasSession(false);
        }
      } catch (err) {
        console.error('[Navbar] ❌ Error loading user:', err);
      } finally {
        clearTimeout(timeout);
        if (mounted) {
          setIsLoading(false);
          console.log('[Navbar] ✅ Loading complete, isLoading set to false');
        }
      }
    }).catch((err) => {
      console.error('[Navbar] ❌ Session error:', err);
      clearTimeout(timeout);
      if (mounted) setIsLoading(false);
    });

    // 세션 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[Navbar] Auth state changed:', _event, session?.user?.id);
      setSessionId(session?.user?.id || '');
      
      try {
        if (session?.user) {
          setHasSession(true);
          console.log('[Navbar] Fetching user data for:', session.user.id);
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('nickname')
            .eq('user_id', session.user.id)
            .is('deleted_at', null)
            .maybeSingle();

          console.log('[Navbar] User query result:', userData, userError);

          if (userData) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              nickname: userData.nickname,
            });
            console.log('[Navbar] ✅ User set successfully:', userData.nickname);
          } else {
            console.log('[Navbar] ⚠️ Auth state: session exists but no user data');
            setUser(null);
          }
        } else {
          console.log('[Navbar] No session, clearing user');
          setHasSession(false);
          setUser(null);
        }
      } catch (err) {
        console.error('[Navbar] Auth state change error:', err);
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 로그아웃 핸들러
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    closeMobile();
  };

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
                <Image
                src="/images/logo1-noBG.png"
                alt="Bitcos 로고"
                width={24}
                height={24}
                className="h-6 w-6"
                priority
              />
              <span className="text-lg">Bitcos</span>
            </Link>
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
              {/* 디버그: 항상 상태 표시 */}
              <div className="text-xs text-muted-foreground px-2">
                Loading: {isLoading ? 'Y' : 'N'} | Session: {sessionId ? 'Y' : 'N'} | User: {user ? user.nickname : 'N'}
              </div>
              {isLoading ? (
                <div className="h-8 w-20 animate-pulse rounded bg-muted" />
              ) : user ? (
                <>
                  <div className="flex items-center gap-2 px-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{user.nickname}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="gap-1"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden lg:inline">로그아웃</span>
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                    >
                      <LogIn className="h-4 w-4" />
                      <span className="hidden lg:inline">로그인</span>
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="hidden lg:inline">회원가입</span>
                    </Button>
                  </Link>
                </>
              )}
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
              {isLoading ? (
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
              ) : user ? (
                <>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 flex-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{user.nickname}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    로그아웃
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login" className="flex-1" onClick={closeMobile}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                    >
                      <LogIn className="h-4 w-4" />
                      로그인
                    </Button>
                  </Link>
                  <Link href="/signup" className="flex-1" onClick={closeMobile}>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full justify-start gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      <UserPlus className="h-4 w-4" />
                      회원가입
                    </Button>
                  </Link>
                </>
              )}
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
    </>
  );
}
