"use client";

/**
 * 개인정보 조회/수정 페이지
 * - 조회: email, nickname, created_at, voting_coin_balance
 * - 수정: nickname만 (중복 검사 후)
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

type ProfileData = {
  email: string;
  nickname: string;
  created_at: string | null;
  voting_coin_balance: number;
  nickname_updated_at: string | null;
  next_change_allowed_at: string | null;
};

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 10;
const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9]+$/;

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16) || "—";
  }
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10) || "—";
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [nicknameError, setNicknameError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nicknameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) setUserId(session.user.id);

      const res = await fetch("/api/profile", { credentials: "include" });
      const json = await res.json();
      if (cancelled) return;
      if (json?.success && json?.data) {
        const d = json.data;
        setProfile({
          email: d.email ?? "",
          nickname: d.nickname ?? "",
          created_at: d.created_at ?? null,
          voting_coin_balance: d.voting_coin_balance ?? 0,
          nickname_updated_at: d.nickname_updated_at ?? null,
          next_change_allowed_at: d.next_change_allowed_at ?? null,
        });
        setNickname(d.nickname ?? "");
      } else {
          if (json?.error?.code === "UNAUTHORIZED") {
            router.replace("/login?redirect=/profile");
            return;
          }
        setError(json?.error?.message ?? "정보를 불러오는데 실패했습니다.");
      }
    };

    load().catch(() => {
      if (!cancelled) setError("네트워크 오류가 발생했습니다.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const validateNickname = (value: string): boolean => {
    if (!value) {
      setNicknameError("");
      return false;
    }
    if (!NICKNAME_PATTERN.test(value)) {
      setNicknameError("닉네임은 한글, 영어, 숫자만 사용할 수 있습니다.");
      return false;
    }
    if (value.length < NICKNAME_MIN) {
      setNicknameError(`닉네임은 ${NICKNAME_MIN}자 이상이어야 합니다.`);
      return false;
    }
    if (value.length > NICKNAME_MAX) {
      setNicknameError(`닉네임은 ${NICKNAME_MAX}자 이하여야 합니다.`);
      return false;
    }
    setNicknameError("");
    return true;
  };

  const checkNickname = async (value: string) => {
    if (!value || value.length < NICKNAME_MIN) {
      setNicknameAvailable(null);
      return;
    }
    setIsCheckingNickname(true);
    try {
      const params = new URLSearchParams({ nickname: value });
      if (userId) params.set("exclude_user_id", userId);
      const res = await fetch(`/api/auth/check-nickname?${params}`);
      const data = await res.json();
      if (res.ok) {
        setNicknameAvailable(data.available);
      } else {
        setNicknameAvailable(false);
      }
    } catch {
      setNicknameAvailable(null);
    } finally {
      setIsCheckingNickname(false);
    }
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);
    setNicknameAvailable(null);

    const isValid = validateNickname(value);

    if (nicknameTimeoutRef.current) clearTimeout(nicknameTimeoutRef.current);
    if (isValid) {
      nicknameTimeoutRef.current = setTimeout(() => checkNickname(value), 500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nicknameAvailable || !!nicknameError || !nickname.trim()) return;
    if (profile && nickname.trim() === profile.nickname) {
      setError(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
        credentials: "include",
      });
      const json = await res.json();

      if (json?.success) {
        const nextAt = json.data?.next_change_allowed_at ?? null;
        setProfile((p) =>
          p
            ? {
                ...p,
                nickname: json.data.nickname,
                nickname_updated_at: json.data.nickname_updated_at ?? p.nickname_updated_at,
                next_change_allowed_at: nextAt ?? p.next_change_allowed_at,
              }
            : null
        );
        setNicknameAvailable(null);
        window.dispatchEvent(new Event("user-balance-updated"));
        window.dispatchEvent(new Event("user-profile-updated"));
        alert("닉네임이 수정되었습니다.");
        router.push("/landing");
      } else {
        setError(json?.error?.message ?? "수정에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canChangeNickname =
    !profile?.next_change_allowed_at || new Date() >= new Date(profile.next_change_allowed_at);
  const isSameNickname = profile && nickname.trim() === profile.nickname;
  const canSubmit =
    canChangeNickname &&
    nicknameAvailable &&
    !nicknameError &&
    nickname.trim().length >= NICKNAME_MIN &&
    !isSameNickname &&
    !isSubmitting;

  if (loading) {
    return (
      <div className="min-h-screen py-6 sm:py-8">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen py-6 sm:py-8">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
              <Link href="/" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
                ← 홈으로
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">개인정보 조회/수정</CardTitle>
            <CardDescription>
              회원 정보를 확인하고 닉네임만 수정할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 조회 전용 필드 */}
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">이메일</Label>
                <p className="mt-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  {profile?.email ?? "—"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">가입일</Label>
                <p className="mt-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  {formatDateTime(profile?.created_at ?? null)}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">보팅 코인 잔액 (VTC)</Label>
                <p className="mt-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium tabular-nums">
                  {profile?.voting_coin_balance?.toLocaleString() ?? "—"}
                </p>
              </div>
            </div>

            {/* 닉네임 수정 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nickname">
                  닉네임 <span className="text-destructive">*</span>
                </Label>
                {!canChangeNickname && profile?.next_change_allowed_at && (
                  <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                    한 번 변경 후 7일이 지나야 다시 변경할 수 있습니다. 다음 변경 가능일:{" "}
                    {formatDateOnly(profile.next_change_allowed_at)}
                  </p>
                )}
                <div className="relative">
                  <Input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={handleNicknameChange}
                    placeholder="닉네임을 입력하세요"
                    maxLength={NICKNAME_MAX}
                    disabled={isSubmitting || !canChangeNickname}
                    className="pr-10"
                  />
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
                <p className="text-xs text-muted-foreground">
                  {NICKNAME_MIN}-{NICKNAME_MAX}자, 한글/영어/숫자만 사용 가능
                </p>
                {nicknameError && <p className="text-xs text-destructive">{nicknameError}</p>}
                {!nicknameError && nicknameAvailable === false && (
                  <p className="text-xs text-destructive">이미 사용 중인 닉네임입니다.</p>
                )}
                {!nicknameError && nicknameAvailable === true && (
                  <p className="text-xs text-green-600 dark:text-green-400">사용 가능한 닉네임입니다.</p>
                )}
              </div>

              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={!canSubmit} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  "닉네임 저장"
                )}
              </Button>
            </form>

            <Link
              href="/profile/stats"
              className="block text-center text-sm text-muted-foreground hover:text-foreground"
            >
              전적 및 승률 조회 →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
