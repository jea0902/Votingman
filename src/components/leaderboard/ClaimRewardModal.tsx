"use client";

/**
 * 보상 받기 모달
 * [축하 메시지] → [번호 입력창] → [개인정보 동의] → [제출 버튼]
 */

import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rank: number;
  onSubmit: (phoneNumber: string, privacyConsent: boolean) => Promise<void>;
};

export function ClaimRewardModal({
  open,
  onOpenChange,
  rank,
  onSubmit,
}: Props) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    const trimmed = phoneNumber.trim().replace(/-/g, "");
    if (!trimmed) {
      setError("휴대폰 번호를 입력해주세요.");
      return;
    }
    if (!/^01[0-9]{8,9}$/.test(trimmed)) {
      setError("올바른 휴대폰 번호를 입력해주세요. (010으로 시작, 10~11자리)");
      return;
    }
    if (!privacyConsent) {
      setError("개인정보 수집·이용에 동의해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed, privacyConsent);
      onOpenChange(false);
      setPhoneNumber("");
      setPrivacyConsent(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-600" />
              보상 받기
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* 1. 축하 메시지 */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-center">
              <p className="text-sm font-medium text-foreground">
                🎉 축하합니다! {rank}위로 선물하기 3만원권 수령 대상입니다.
              </p>
            </div>

            {/* 2. 번호 입력창 */}
            <div className="space-y-2">
              <Label htmlFor="reward-phone">휴대폰 번호</Label>
              <Input
                id="reward-phone"
                type="tel"
                placeholder="01012345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* 3. 개인정보 동의 */}
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  disabled={isSubmitting}
                  className="mt-1 rounded border-input"
                />
                <span className="text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setPrivacyModalOpen(true)}
                    className="text-primary underline hover:no-underline"
                  >
                    개인정보 수집·이용
                  </button>
                  에 동의합니다. (보상 지급을 위해 휴대폰 번호가 수집됩니다.)
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* 4. 제출 버튼 */}
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  제출 중...
                </>
              ) : (
                "제출"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 개인정보 동의 상세 모달 */}
      <Dialog open={privacyModalOpen} onOpenChange={setPrivacyModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>[개인정보 수집 및 이용 동의]</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm text-foreground">
            <div>
              <p className="font-medium mb-2">1. 수집 항목</p>
              <ul className="text-muted-foreground space-y-1 pl-4 list-disc">
                <li>(소셜) 이메일, 닉네임, 프로필 이미지</li>
                <li>(이용 시) 서비스 로그, IP, 기기 정보</li>
                <li>(보상 시) 휴대폰 번호</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-2">2. 목적</p>
              <p className="text-muted-foreground pl-4">
                회원 식별, 서비스 운영, 보상 지급 및 부정 이용 방지
              </p>
            </div>
            <div>
              <p className="font-medium mb-2">3. 보유 기간</p>
              <div className="text-muted-foreground pl-4 space-y-1">
                <p>회원 탈퇴 시 즉시 파기</p>
                <p className="pl-2">(단, 보상 관련 기록은 CS 대응을 위해 6개월 보관)</p>
              </div>
            </div>
            <div>
              <p className="font-medium mb-2">4. 거부 권리</p>
              <p className="text-muted-foreground pl-4">
                동의를 거부할 수 있으나, 이 경우 가입 및 보상 수령이 제한됩니다.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setPrivacyModalOpen(false)}>확인</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
