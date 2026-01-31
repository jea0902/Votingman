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
        
        setSessionId(session.user.id);
        setHasSession(true);
        
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
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <nav
          className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
          aria-label="메인 네비게이션"
        >
          {/* 좌측: 로고 */}
          <div className="flex items-center gap-3 sm:gap-4">

            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
              onClick={closeMobile}
            >
              {/* 로고 이미지 - 네비게이션 바 높이를 거의 다 활용 (h-14 = 56px, 여기서는 h-13 = 52px 사용) */}
              <Image
                src="/images/logo.png"
                alt="Bitcos 로고"
                width={52}
                height={52}
                className="h-13 w-auto object-contain"
                style={{ height: '52px' }}
                priority
              />
              <span className="text-lg">비트코스</span>
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
              {/* 디버그 텍스트 제거 */}
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
