"use client";

/**
 * 회원가입 페이지
 * 
 * 설계 의도:
 * - 구글 OAuth로 이메일 자동 가져오기
 * - 닉네임만 입력 (중복 체크)
 * - 완료 시 로그인 페이지로 리다이렉트
 * 
 * UX:
 * - 2단계 흐름: 구글 인증 → 닉네임 입력
 * - 실시간 닉네임 중복 체크
 * - 진행 상태 명확하게 표시
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type SignupStep = "google" | "nickname";

export default function SignupPage() {
  const router = useRouter();
  
  // 단계 관리
  const [step, setStep] = useState<SignupStep>("google");
  
  // 구글 로그인 상태
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  
  // 닉네임 상태
  const [nickname, setNickname] = useState("");
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [error, setError] = useState("");

  // 구글 로그인
  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    setError("");

    try {
      const supabase = createClient();
      
      // Google OAuth 로그인 (회원가입)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback/signup`,
        },
      });

      if (error) {
        throw error;
      }

      // Google 로그인 페이지로 리다이렉트됨 (자동)
      
    } catch (err) {
      console.error("Google signup failed:", err);
      setError("구글 로그인에 실패했습니다. 다시 시도해주세요.");
      setIsGoogleLoading(false);
    }
  };

  // 구글 로그인 후 돌아왔을 때 처리
  useEffect(() => {
    const supabase = createClient();
    const searchParams = new URLSearchParams(window.location.search);
    const urlStep = searchParams.get('step');
    
    // URL 파라미터로 닉네임 단계인지 확인
    if (urlStep === 'nickname') {
      // 세션 확인
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setGoogleEmail(session.user.email || "");
          setStep("nickname");
        } else {
          // 세션이 없으면 첫 단계로
          setError("세션이 만료되었습니다. 다시 시도해주세요.");
        }
      });
    }
  }, []);

  // 닉네임 중복 체크 (디바운스)
  const checkNickname = async (value: string) => {
    if (!value || value.length < 2) {
      setNicknameAvailable(null);
      return;
    }

    setIsCheckingNickname(true);
    
    try {
      const response = await fetch(`/api/auth/check-nickname?nickname=${encodeURIComponent(value)}`);
      const data = await response.json();
      
      if (response.ok) {
        setNicknameAvailable(data.available);
      } else {
        setNicknameAvailable(false);
      }
    } catch (err) {
      console.error("Nickname check failed:", err);
      setNicknameAvailable(null);
    } finally {
      setIsCheckingNickname(false);
    }
  };

  // 닉네임 유효성 검사 (한글, 영어, 숫자만 허용)
  const [nicknameError, setNicknameError] = useState<string>("");
  
  const validateNickname = (value: string): boolean => {
    // 빈 값 체크
    if (!value) {
      setNicknameError("");
      return false;
    }
    
    // 한글, 영어, 숫자만 허용하는 정규식
    const validPattern = /^[가-힣a-zA-Z0-9]+$/;
    
    if (!validPattern.test(value)) {
      setNicknameError("닉네임은 한글, 영어, 숫자만 사용할 수 있습니다");
      return false;
    }
    
    if (value.length < 2) {
      setNicknameError("닉네임은 2자 이상이어야 합니다");
      return false;
    }
    
    if (value.length > 10) {
      setNicknameError("닉네임은 10자 이하여야 합니다");
      return false;
    }
    
    setNicknameError("");
    return true;
  };

  // 닉네임 입력 핸들러 (디바운스)
  const [nicknameTimeout, setNicknameTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);
    setNicknameAvailable(null);
    
    // 유효성 검사
    const isValid = validateNickname(value);
    
    // 기존 타이머 취소
    if (nicknameTimeout) {
      clearTimeout(nicknameTimeout);
    }
    
    // 유효한 경우에만 중복 체크
    if (isValid) {
      // 새 타이머 설정 (500ms 디바운스)
      const timeoutId = setTimeout(() => {
        checkNickname(value);
      }, 500);
      
      setNicknameTimeout(timeoutId);
    }
  };

  // 회원가입 완료
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nicknameAvailable) {
      setError("사용 가능한 닉네임을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const supabase = createClient();
      
      // 현재 세션 확인
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        throw new Error("세션이 만료되었습니다. 다시 시도해주세요.");
      }

      // users 테이블에 닉네임 저장
      // 재가입 시 기존 데이터가 있을 수 있으므로 먼저 확인
      const { data: existingUser } = await supabase
        .from('users')
        .select('user_id')
        .eq('email', session.user.email!)
        .maybeSingle();

      if (existingUser) {
        // 기존 사용자가 있으면 업데이트 (재가입)
        const { error: updateError } = await supabase
          .from('users')
          .update({
            user_id: session.user.id,
            nickname: nickname.trim(),
            deleted_at: null, // soft delete 해제
          })
          .eq('email', session.user.email!);

        if (updateError) {
          throw updateError;
        }
      } else {
        // 신규 사용자면 삽입
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            user_id: session.user.id,
            email: session.user.email!,
            nickname: nickname.trim(),
          });

        if (insertError) {
          throw insertError;
        }
      }

      // 성공: 로그인 페이지로 리다이렉트
      router.push("/login");
      
    } catch (err) {
      console.error("Signup failed:", err);
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다. 다시 시도해주세요.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
          <CardDescription>
            {step === "google" 
              ? "구글 계정으로 간편하게 가입하세요" 
              : "닉네임을 설정해주세요"
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* STEP 1: 구글 로그인 */}
          {step === "google" && (
            <>
              <Button
                onClick={handleGoogleSignup}
                disabled={isGoogleLoading}
                className="w-full h-12 text-base font-medium"
                size="lg"
              >
                {isGoogleLoading ? (
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
                Google로 3초 가입
              </>
            )}
          </Button>
            </>
          )}

          {/* STEP 2: 닉네임 입력 */}
          {step === "nickname" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 이메일 확인 */}
              <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">구글 계정</p>
                <p className="text-sm font-medium text-foreground">{googleEmail}</p>
              </div>

              {/* 닉네임 입력 */}
              <div className="space-y-2">
                <Label htmlFor="nickname">
                  닉네임 <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={handleNicknameChange}
                    placeholder="사용할 닉네임을 입력하세요"
                    maxLength={10}
                    disabled={isSubmitting}
                    className="pr-10"
                    required
                  />
                  {/* 중복 체크 아이콘 */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingNickname && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {!isCheckingNickname && !nicknameError && nicknameAvailable === true && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {!isCheckingNickname && (nicknameError || nicknameAvailable === false) && nickname.length > 0 && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
                
                {/* 닉네임 안내 */}
                <div className="text-xs space-y-1">
                  <p className="text-muted-foreground">
                    • 2-10자, 한글/영어/숫자만 사용 가능
                  </p>
                  {nicknameError && (
                    <p className="text-destructive">
                      • {nicknameError}
                    </p>
                  )}
                  {!nicknameError && nicknameAvailable === false && (
                    <p className="text-destructive">
                      • 이미 사용 중인 닉네임입니다
                    </p>
                  )}
                  {!nicknameError && nicknameAvailable === true && (
                    <p className="text-green-600 dark:text-green-400">
                      • 사용 가능한 닉네임입니다
                    </p>
                  )}
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* 완료 버튼 */}
              <Button
                type="submit"
                disabled={isSubmitting || !nicknameAvailable || !!nicknameError}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    가입 중...
                  </>
                ) : (
                  "회원가입 완료"
                )}
              </Button>
            </form>
          )}

          {/* 로그인 링크 (구글 단계에만 표시) */}
          {step === "google" && (
            <>
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

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  이미 계정이 있으신가요?
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full" size="lg">
                    로그인
                  </Button>
                </Link>
              </div>
            </>
          )}

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
