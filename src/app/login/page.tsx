"use client";

/**
 * 로그인 페이지
 * 
 * 설계 의도:
 * - 구글 OAuth만 지원 (간편하고 안전)
 * - 원클릭 로그인
 * - 회원가입 링크 명확하게 표시
 * 
 * UX:
 * - 최소한의 클릭 (구글 버튼 1번)
 * - 직관적인 레이아웃
 * - 회원가입 경로 명확
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // URL 파라미터에서 메시지 표시
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlMessage = searchParams.get('message');
    
    if (urlMessage === 'already_registered') {
      setMessage("이미 가입된 계정입니다. 로그인해주세요.");
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError("");

    try {
      const supabase = createClient();
      
      // Google OAuth 로그인
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      // Google 로그인 페이지로 리다이렉트됨 (자동)
      
    } catch (err) {
      console.error("Login failed:", err);
      setError("로그인에 실패했습니다. 다시 시도해주세요.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">로그인</CardTitle>
          <CardDescription>
            구글 계정으로 간편하게 로그인하세요
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 구글 로그인 버튼 */}
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Google 연동 중...
              </>
            ) : (
              <>
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google로 간편 로그인
              </>
            )}
          </Button>

          {/* 정보 메시지 */}
          {message && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
              {message}
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* 구분선 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                또는
              </span>
            </div>
          </div>

          {/* 회원가입 링크 */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              아직 계정이 없으신가요?
            </p>
            <Link href="/signup">
              <Button variant="outline" className="w-full" size="lg">
                회원가입
              </Button>
            </Link>
          </div>

          {/* 홈으로 돌아가기 */}
          <div className="text-center pt-4">
            <Link 
              href="/" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← 홈으로 돌아가기
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
