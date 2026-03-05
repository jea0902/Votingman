"use client";

/**
 * 회원가입 페이지
 * 
 * 설계 의도:
 * - 구글 OAuth 또는 카카오 OAuth로 이메일 자동 가져오기
 * - 닉네임만 입력 (중복 체크)
 * - 레퍼럴 코드가 있으면 가입 완료 후 처리
 * - 완료 시 로그인 페이지로 리다이렉트
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

type SignupStep = "social" | "nickname" | "privacy" | "phone";

// 랜덤 8자리 영숫자 레퍼럴 코드 생성
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 휴대폰 번호 형식 검증
function validatePhoneNumber(phone: string): boolean {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return /^010[0-9]{8}$/.test(cleanPhone);
}

// 휴대폰 번호 포맷팅 (010-0000-0000)
function formatPhoneNumber(phone: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length <= 3) return cleanPhone;
  if (cleanPhone.length <= 7) return `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3)}`;
  return `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 7)}-${cleanPhone.slice(7, 11)}`;
}

export default function SignupPage() {
  const router = useRouter();

  const [step, setStep] = useState<SignupStep>("social");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [refCode, setRefCode] = useState<string | null>(null); // URL에서 읽은 레퍼럴 코드

  const [nickname, setNickname] = useState("");
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nicknameError, setNicknameError] = useState<string>("");
  const [error, setError] = useState("");

  // 개인정보 동의 관련 상태
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // 휴대폰 인증 관련 상태
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [smsTimer, setSmsTimer] = useState(0);
  const [smsError, setSmsError] = useState("");

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // ref 코드를 localStorage에 저장
      if (refCode) {
        localStorage.setItem('pending_ref_code', refCode);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback/signup`,
        },
      });

      if (error) throw error;

    } catch (err) {
      console.error("Google signup failed:", err);
      setError("구글 로그인에 실패했습니다. 다시 시도해주세요.");
      setIsGoogleLoading(false);
    }
  };

  const handleKakaoSignup = async () => {
    setIsKakaoLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // ref 코드를 localStorage에 저장
      if (refCode) {
        localStorage.setItem('pending_ref_code', refCode);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback/signup`,
        },
      });

      if (error) throw error;

    } catch (err) {
      console.error("Kakao signup failed:", err);
      setError("카카오 로그인에 실패했습니다. 다시 시도해주세요.");
      setIsKakaoLoading(false);
    }
  };

  // 소셜 로그인 후 돌아왔을 때 처리
  useEffect(() => {
    const supabase = createClient();
    const searchParams = new URLSearchParams(window.location.search);
    const urlStep = searchParams.get('step');
    const urlRef = searchParams.get('ref');

    // 레퍼럴 코드 저장
    if (urlRef) {
      setRefCode(urlRef);
    } else {
      // 첫 진입 시에도 ref 파라미터 확인
      const initialRef = new URLSearchParams(window.location.search).get('ref');
      if (initialRef) setRefCode(initialRef);
    }

    if (urlStep === 'nickname') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUserEmail(session.user.email || "");

          // localStorage에서 ref 코드 복원
          const savedRef = localStorage.getItem('pending_ref_code');
          if (savedRef) {
            setRefCode(savedRef);
            localStorage.removeItem('pending_ref_code'); // 읽은 후 삭제
          }

          setStep("nickname");
        } else {
          setError("세션이 만료되었습니다. 다시 시도해주세요.");
        }
      });
    }
  }, []);

  const checkNickname = async (value: string) => {
    if (!value || value.length < 2) {
      setNicknameAvailable(null);
      return;
    }

    setIsCheckingNickname(true);

    try {
      const response = await fetch(`/api/auth/check-nickname?nickname=${encodeURIComponent(value)}`);
      const data = await response.json();
      setNicknameAvailable(response.ok ? data.available : false);
    } catch (err) {
      console.error("Nickname check failed:", err);
      setNicknameAvailable(null);
    } finally {
      setIsCheckingNickname(false);
    }
  };

  const validateNickname = (value: string): boolean => {
    if (!value) {
      setNicknameError("");
      return false;
    }

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

  const [nicknameTimeout, setNicknameTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);
    setNicknameAvailable(null);

    const isValid = validateNickname(value);

    if (nicknameTimeout) clearTimeout(nicknameTimeout);

    if (isValid) {
      const timeoutId = setTimeout(() => checkNickname(value), 500);
      setNicknameTimeout(timeoutId);
    }
  };

  // SMS 발송 함수 (네이버 클라우드 SENS 구조)
  const sendSmsVerification = async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setSmsError("올바른 휴대폰 번호를 입력해주세요. (010-0000-0000)");
      return;
    }

    setIsSendingSms(true);
    setSmsError("");

    try {
      const response = await fetch('/api/auth/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: phoneNumber.replace(/[^0-9]/g, '') 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsVerificationSent(true);
        setSmsTimer(180); // 3분 타이머
        
        // 타이머 시작
        const timer = setInterval(() => {
          setSmsTimer(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              setIsVerificationSent(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

      } else {
        setSmsError(data.error || "SMS 발송에 실패했습니다.");
      }
    } catch (err) {
      console.error("SMS send failed:", err);
      setSmsError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSendingSms(false);
    }
  };

  // SMS 인증 확인 함수
  const verifyPhoneCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setSmsError("6자리 인증번호를 입력해주세요.");
      return;
    }

    setIsVerifyingCode(true);
    setSmsError("");

    try {
      const response = await fetch('/api/auth/verify-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.replace(/[^0-9]/g, ''),
          code: verificationCode
        }),
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        setPhoneVerified(true);
        setSmsTimer(0);
        // 다음 단계로 자동 진행 또는 완료 처리
      } else {
        setSmsError(data.error || "인증번호가 일치하지 않습니다.");
        setVerificationCode("");
      }
    } catch (err) {
      console.error("SMS verify failed:", err);
      setSmsError("인증 확인 중 오류가 발생했습니다.");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // 다음 단계 진행 함수들
  const proceedToPrivacy = () => {
    setStep("privacy");
  };

  const proceedToPhone = () => {
    if (!privacyConsent || !termsConsent) {
      setError("필수 약관에 동의해주세요.");
      return;
    }
    setStep("phone");
    setError("");
  };

  const proceedToComplete = async () => {
    if (!phoneVerified) {
      setSmsError("휴대폰 인증을 완료해주세요.");
      return;
    }
    
    // 최종 회원가입 처리
    await handleFinalSubmit();
  };

  const handleFinalSubmit = async () => {

    if (!nicknameAvailable) {
      setError("사용 가능한 닉네임을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const supabase = createClient();

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error("세션이 만료되었습니다. 다시 시도해주세요.");
      }

      // 이미 가입된 유저 체크 (탈퇴 안 한)
      const { data: existingUser } = await supabase
        .from('users')
        .select('user_id, deleted_at')
        .eq('email', session.user.email!)
        .maybeSingle();

      if (existingUser && !existingUser.deleted_at) {
        // 정상 가입된 유저 → 로그인 페이지로
        router.push("/login?message=already_registered");
        return;
      }

      // 레퍼럴 코드 생성
      const newReferralCode = generateReferralCode();

      if (existingUser && existingUser.deleted_at) {
        // 탈퇴 유저 → 재활성화 (referral_code는 유지)
        const { error: updateError } = await supabase
          .from('users')
          .update({
            user_id: session.user.id,
            nickname: nickname.trim(),
            deleted_at: null,
            phone_number: phoneNumber.replace(/[^0-9]/g, ''),
            phone_verified_at: new Date().toISOString(),
            privacy_agreed_at: new Date().toISOString(),
            marketing_agreed: marketingConsent,
          })
          .eq('email', session.user.email!);

        if (updateError) throw updateError;
      } else {
        // 신규 유저 → insert
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            user_id: session.user.id,
            email: session.user.email!,
            nickname: nickname.trim(),
            referral_code: newReferralCode,
            phone_number: phoneNumber.replace(/[^0-9]/g, ''),
            phone_verified_at: new Date().toISOString(),
            privacy_agreed_at: new Date().toISOString(),
            marketing_agreed: marketingConsent,
          });

        if (insertError) {
          console.error("Insert error details:", insertError.code, insertError.message, insertError.details);
          throw insertError;
        }
      }

      // 레퍼럴 코드가 있으면 API 호출
      if (refCode) {
        const referralRes = await fetch('/api/auth/referral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referralCode: refCode }),
        });

        if (!referralRes.ok) {
          const data = await referralRes.json();
          // 레퍼럴 실패해도 가입은 완료 (조용히 처리)
          console.warn("Referral processing failed:", data.error);
        }
      }

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
            {step === "social" && "소셜 계정으로 간편하게 가입하세요"}
            {step === "nickname" && "닉네임을 설정해주세요"}
            {step === "privacy" && "서비스 이용을 위한 필수 약관에 동의해주세요"}
            {step === "phone" && "본인 인증을 위해 휴대폰 번호를 인증해주세요"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* STEP 1: 소셜 로그인 */}
          {step === "social" && (
            <>
              {/* 레퍼럴 코드 안내 */}
              {refCode && (
                <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-yellow-500/5 px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">🎁</span>
                    <p className="text-sm font-semibold text-amber-400">친구 초대 코드가 적용됩니다!</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">추천 코드</p>
                      <p className="font-mono font-bold text-foreground tracking-widest">{refCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">가입 보너스</p>
                      <p className="font-bold text-amber-400">+1,000 VTC</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 구글 가입 버튼 */}
              <Button
                onClick={handleGoogleSignup}
                disabled={isGoogleLoading || isKakaoLoading}
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
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google로 3초 가입
                  </>
                )}
              </Button>

              {/* 카카오 가입 버튼 */}
              <Button
                onClick={handleKakaoSignup}
                disabled={isGoogleLoading || isKakaoLoading}
                className="w-full h-12 text-base font-medium bg-[#FEE500] hover:bg-[#FDD835] text-[#191919]"
                size="lg"
              >
                {isKakaoLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    카카오 연동 중...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="#191919">
                      <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.548 1.516 4.788 3.809 6.13l-.971 3.603a.375.375 0 0 0 .545.415L9.51 18.35A11.1 11.1 0 0 0 12 18c5.523 0 10-3.477 10-7.5S17.523 3 12 3z" />
                    </svg>
                    카카오로 3초 가입
                  </>
                )}
              </Button>
            </>
          )}

          {/* STEP 2: 닉네임 입력 */}
          {step === "nickname" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">가입 계정</p>
                <p className="text-sm font-medium text-foreground">{userEmail}</p>
              </div>

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
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingNickname && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!isCheckingNickname && !nicknameError && nicknameAvailable === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {!isCheckingNickname && (nicknameError || nicknameAvailable === false) && nickname.length > 0 && <XCircle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <p className="text-muted-foreground">• 2-10자, 한글/영어/숫자만 사용 가능</p>
                  {nicknameError && <p className="text-destructive">• {nicknameError}</p>}
                  {!nicknameError && nicknameAvailable === false && <p className="text-destructive">• 이미 사용 중인 닉네임입니다</p>}
                  {!nicknameError && nicknameAvailable === true && <p className="text-green-600 dark:text-green-400">• 사용 가능한 닉네임입니다</p>}
                </div>
              </div>

              {/* 추천인 코드 입력 (선택) */}
              <div className="space-y-2">
                <Label htmlFor="refCodeInput">
                  추천인 코드 <span className="text-muted-foreground text-xs">(선택)</span>
                </Label>
                <Input
                  id="refCodeInput"
                  type="text"
                  value={refCode ?? ""}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase() || null)}
                  placeholder="추천인 코드를 입력하세요"
                  maxLength={8}
                  disabled={isSubmitting}
                />
                {refCode && (
                  <p className="text-xs text-primary">
                    • 가입 완료 시 나와 추천인 모두 1,000 VTC를 받아요
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="button"
                onClick={proceedToPrivacy}
                disabled={!nicknameAvailable || !!nicknameError}
                className="w-full"
                size="lg"
              >
                다음 단계
              </Button>
            </div>
          )}

          {/* STEP 3: 개인정보 동의 */}
          {step === "privacy" && (
            <div className="space-y-6">
              <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">가입 계정</p>
                <p className="text-sm font-medium text-foreground">{userEmail}</p>
                <p className="text-xs text-muted-foreground mt-1">닉네임: {nickname}</p>
              </div>

              <div className="space-y-4">
                <div className="text-sm font-medium text-foreground mb-4">
                  서비스 이용약관 및 개인정보 처리방침
                </div>

                {/* 필수 약관들 */}
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacyConsent}
                      onChange={(e) => setPrivacyConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">[필수] 개인정보 수집·이용 동의</span>
                        <button className="text-xs text-primary underline">보기</button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        서비스 제공을 위한 필수 개인정보 수집에 동의합니다.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termsConsent}
                      onChange={(e) => setTermsConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">[필수] 서비스 이용약관 동의</span>
                        <button className="text-xs text-primary underline">보기</button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        보팅맨 서비스 이용약관에 동의합니다.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground">[선택] 마케팅 정보 수신 동의</span>
                        <button className="text-xs text-primary underline">보기</button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        이벤트, 혜택 정보 등 마케팅 알림을 받겠습니다. (이메일, SMS)
                      </p>
                    </div>
                  </label>
                </div>

                {/* 전체 동의 */}
                <div className="border-t border-border pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacyConsent && termsConsent && marketingConsent}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPrivacyConsent(checked);
                        setTermsConsent(checked);
                        setMarketingConsent(checked);
                      }}
                      className="h-5 w-5 rounded border-gray-300"
                    />
                    <span className="text-sm font-semibold text-foreground">
                      위 모든 약관에 동의합니다
                    </span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("nickname")}
                  className="flex-1"
                  size="lg"
                >
                  이전
                </Button>
                <Button
                  onClick={proceedToPhone}
                  disabled={!privacyConsent || !termsConsent}
                  className="flex-1"
                  size="lg"
                >
                  다음 단계
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: 휴대폰 인증 */}
          {step === "phone" && (
            <div className="space-y-6">
              <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">가입 계정</p>
                <p className="text-sm font-medium text-foreground">{userEmail}</p>
                <p className="text-xs text-muted-foreground mt-1">닉네임: {nickname}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">
                    휴대폰 번호 <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={formatPhoneNumber(phoneNumber)}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="010-0000-0000"
                      maxLength={13}
                      disabled={phoneVerified}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={sendSmsVerification}
                      disabled={isSendingSms || phoneVerified || !validatePhoneNumber(phoneNumber)}
                      variant="outline"
                      className="whitespace-nowrap"
                    >
                      {isSendingSms ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : phoneVerified ? (
                        "인증완료"
                      ) : isVerificationSent ? (
                        "재전송"
                      ) : (
                        "인증번호"
                      )}
                    </Button>
                  </div>

                  {isVerificationSent && !phoneVerified && (
                    <p className="text-xs text-primary">
                      인증번호가 발송되었습니다. ({Math.floor(smsTimer / 60)}:{String(smsTimer % 60).padStart(2, '0')})
                    </p>
                  )}
                </div>

                {isVerificationSent && !phoneVerified && (
                  <div className="space-y-2">
                    <Label htmlFor="verificationCode">
                      인증번호 <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="verificationCode"
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                        placeholder="6자리 인증번호 입력"
                        maxLength={6}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={verifyPhoneCode}
                        disabled={isVerifyingCode || verificationCode.length !== 6}
                        variant="default"
                        className="whitespace-nowrap"
                      >
                        {isVerifyingCode ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "인증확인"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {phoneVerified && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">휴대폰 인증이 완료되었습니다</span>
                  </div>
                )}

                {/* 개발 모드 안내 */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 space-y-2">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      🔧 개발 모드: <strong>인증번호 123456</strong> 또는 콘솔에서 확인하세요
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/auth/reset-sms', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phoneNumber: phoneNumber.replace(/[^0-9]/g, '') })
                          });
                          if (response.ok) {
                            setIsVerificationSent(false);
                            setVerificationCode("");
                            setPhoneVerified(false);
                            setSmsTimer(0);
                            setSmsError("테스트 데이터가 초기화되었습니다. 다시 시도해보세요.");
                          }
                        } catch (err) {
                          console.error('Reset failed:', err);
                        }
                      }}
                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      🔄 테스트 초기화
                    </button>
                  </div>
                )}
              </div>

              {smsError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {smsError}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("privacy")}
                  className="flex-1"
                  size="lg"
                >
                  이전
                </Button>
                <Button
                  onClick={proceedToComplete}
                  disabled={!phoneVerified}
                  className="flex-1"
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
              </div>
            </div>
          )}

          {/* 로그인 링크 (소셜 단계에만 표시) */}
          {step === "social" && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">또는</span>
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">이미 계정이 있으신가요?</p>
                <Link href="/login">
                  <Button variant="outline" className="w-full" size="lg">로그인</Button>
                </Link>
              </div>
            </>
          )}

          <div className="text-center pt-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← 홈으로 돌아가기
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}