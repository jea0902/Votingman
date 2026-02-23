import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * 레퍼럴 처리 API
 * 
 * 설계 의도:
 * - 서버에서 VTC 지급 처리 (클라이언트 조작 방지)
 * - 추천인/피추천인 둘 다 1000 VTC 지급
 * - referral_history 기록
 */

const REFERRAL_REWARD = 1000;

export async function POST(request: NextRequest) {
    try {
        const supabase = await createSupabaseServerClient();
        const supabaseAdmin = createSupabaseAdmin();

        // 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { referralCode } = await request.json();

        if (!referralCode) {
            return NextResponse.json({ error: "레퍼럴 코드가 없습니다." }, { status: 400 });
        }

        const newUserId = session.user.id;

        // 1. 레퍼럴 코드로 추천인 찾기
        const { data: referrer, error: referrerError } = await supabaseAdmin
            .from('users')
            .select('user_id, nickname, voting_coin_balance')
            .eq('referral_code', referralCode)
            .is('deleted_at', null)
            .maybeSingle();

        if (referrerError || !referrer) {
            return NextResponse.json({ error: "유효하지 않은 레퍼럴 코드입니다." }, { status: 400 });
        }

        // 2. 자기 자신 코드로 가입 방지
        if (referrer.user_id === newUserId) {
            return NextResponse.json({ error: "자신의 레퍼럴 코드는 사용할 수 없습니다." }, { status: 400 });
        }

        // 3. 이미 referred_by가 있는지 확인 (중복 방지)
        const { data: newUser } = await supabaseAdmin
            .from('users')
            .select('user_id, nickname, voting_coin_balance, referred_by')
            .eq('user_id', newUserId)
            .maybeSingle();

        if (!newUser) {
            return NextResponse.json({ error: "유저를 찾을 수 없습니다." }, { status: 400 });
        }

        if (newUser.referred_by) {
            return NextResponse.json({ error: "이미 레퍼럴 코드를 사용하셨습니다." }, { status: 400 });
        }

        // 4. 피추천인 referred_by 저장 + VTC 지급
        const { error: newUserUpdateError } = await supabaseAdmin
            .from('users')
            .update({
                referred_by: referralCode,
                voting_coin_balance: (newUser.voting_coin_balance ?? 0) + REFERRAL_REWARD,
            })
            .eq('user_id', newUserId);

        if (newUserUpdateError) {
            throw newUserUpdateError;
        }

        // 5. 추천인 VTC 지급
        const { error: referrerUpdateError } = await supabaseAdmin
            .from('users')
            .update({
                voting_coin_balance: (referrer.voting_coin_balance ?? 0) + REFERRAL_REWARD,
            })
            .eq('user_id', referrer.user_id);

        if (referrerUpdateError) {
            throw referrerUpdateError;
        }

        // 6. referral_history 기록
        const { error: historyError } = await supabaseAdmin
            .from('referral_history')
            .insert({
                referrer_user_id: referrer.user_id,
                referred_user_id: newUserId,
                referred_nickname: newUser.nickname,
            });

        if (historyError) {
            throw historyError;
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error("Referral processing failed:", err);
        return NextResponse.json({ error: "레퍼럴 처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}