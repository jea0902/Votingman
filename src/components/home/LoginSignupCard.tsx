"use client";

/**
 * 로그인/회원가입 카드
 *
 * 설계 의도:
 * - 사이드바 상단에 깔끔한 카드로 배치
 * - 클릭 시 로그인/회원가입 모달 오픈, 오픈 실패 시 에러 처리
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogIn, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoginSignupCard({ className }: { className?: string }) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const openLogin = useCallback(() => {
    try {
      setModalError(null);
      setSignupOpen(false);
      setLoginOpen(true);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "로그인 모달을 열 수 없습니다.");
    }
  }, []);

  const openSignup = useCallback(() => {
    try {
      setModalError(null);
      setLoginOpen(false);
      setSignupOpen(true);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "회원가입 모달을 열 수 없습니다.");
    }
  }, []);

  const closeLogin = useCallback(() => {
    try {
      setLoginOpen(false);
      setModalError(null);
    } catch {
      /* noop */
    }
  }, []);

  const closeSignup = useCallback(() => {
    try {
      setSignupOpen(false);
      setModalError(null);
    } catch {
      /* noop */
    }
  }, []);

  return (
    <>
      <Card className={cn("border-border bg-card", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">계정</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            로그인하고 전략·포지션을 관리하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {modalError && (
            <p className="text-xs text-destructive" role="alert">
              {modalError}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={openLogin}
          >
            <LogIn className="h-4 w-4" />
            로그인
          </Button>
          <Button
            type="button"
            className="w-full justify-start gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            size="sm"
            onClick={openSignup}
          >
            <UserPlus className="h-4 w-4" />
            회원가입
          </Button>
        </CardContent>
      </Card>

      <Dialog open={loginOpen} onOpenChange={(open) => !open && closeLogin()}>
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

      <Dialog open={signupOpen} onOpenChange={(open) => !open && closeSignup()}>
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
