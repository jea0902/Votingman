"use client";

/**
 * 레퍼럴 페이지
 * 
 * - 내 레퍼럴 링크 복사
 * - 추천한 사람 목록 + 정산 내역
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Users, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ReferralHistory {
    referred_nickname: string;
    created_at: string;
}

export default function ReferralPage() {
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [referralHistory, setReferralHistory] = useState<ReferralHistory[]>([]);
    const [copied, setCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            const supabase = createClient();

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            // 내 레퍼럴 코드 가져오기
            const { data: userData } = await supabase
                .from('users')
                .select('referral_code')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (userData) setReferralCode(userData.referral_code);

            // 레퍼럴 내역 가져오기
            const { data: history } = await supabase
                .from('referral_history')
                .select('referred_nickname, created_at')
                .eq('referrer_user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (history) setReferralHistory(history);

            setIsLoading(false);
        };

        loadData();
    }, []);

    const referralLink = referralCode
        ? `${window.location.origin}/signup?ref=${referralCode}`
        : null;

    const handleCopy = async () => {
        if (!referralLink) return;
        await navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">레퍼럴</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    친구를 초대하면 나와 친구 모두 <span className="text-primary font-semibold">1,000 VTC</span>를 받아요
                </p>
            </div>

            {/* 내 레퍼럴 링크 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        내 레퍼럴 링크
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <span className="flex-1 text-sm text-muted-foreground truncate">
                            {referralLink}
                        </span>
                    </div>
                    <Button onClick={handleCopy} className="w-full" size="lg">
                        {copied ? (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                복사됨!
                            </>
                        ) : (
                            <>
                                <Copy className="mr-2 h-4 w-4" />
                                링크 복사
                            </>
                        )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                        내 레퍼럴 코드: <span className="font-mono font-bold text-foreground">{referralCode}</span>
                    </p>
                </CardContent>
            </Card>

            {/* 정산 내역 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        추천 내역
                        <span className="ml-auto text-sm font-normal text-muted-foreground">
                            총 {referralHistory.length}명 · {referralHistory.length * 1000} VTC 획득
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {referralHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            아직 추천한 친구가 없어요
                        </p>
                    ) : (
                        <div className="divide-y divide-border">
                            {referralHistory.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between py-3">
                                    <div>
                                        <p className="text-sm font-medium">{item.referred_nickname}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(item.created_at).toLocaleDateString('ko-KR', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                            })}
                                        </p>
                                    </div>
                                    <span className="text-sm font-semibold text-primary">+1,000 VTC</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}