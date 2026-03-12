/**
 * POST /api/reward/claim
 * TOP 10 보상(선물하기 3만원권) 수령 신청
 * - 서버 세션에서 user_id 확인
 * - user_stats market='all' 기준 MMR TOP 10인지 검증
 * - reward_claims에 period(YYYY-MM), 휴대폰 번호, 개인정보 동의 저장
 * - paid_at: 관리자가 수동 지급 후 업데이트
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

const TOP_N_FOR_REWARD = 10;

function getCurrentPeriodKst(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function POST(request: Request) {
  try {
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const phoneNumber = typeof body.phone_number === "string" ? body.phone_number.trim() : "";
    const privacyConsent = body.privacy_consent === true;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "휴대폰 번호를 입력해주세요." } },
        { status: 400 }
      );
    }
    if (!/^01[0-9]{8,9}$/.test(phoneNumber.replace(/-/g, ""))) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "올바른 휴대폰 번호를 입력해주세요." } },
        { status: 400 }
      );
    }
    if (!privacyConsent) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "개인정보 수집·이용에 동의해주세요." } },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    // TOP 10 확인: user_stats market='all' 기준 MMR 순
    const { data: statsRows, error: statsError } = await admin
      .from("user_stats")
      .select("user_id")
      .eq("market", "all")
      .order("mmr", { ascending: false })
      .limit(TOP_N_FOR_REWARD);

    if (statsError || !statsRows) {
      console.error("Reward claim: user_stats error", statsError);
      return NextResponse.json(
        { success: false, error: { code: "SERVER_ERROR", message: "랭킹 확인에 실패했습니다." } },
        { status: 500 }
      );
    }

    const top10UserIds = new Set(statsRows.map((r) => r.user_id));
    if (!top10UserIds.has(user.id)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "TOP 10에 해당하는 유저만 보상을 신청할 수 있습니다." } },
        { status: 403 }
      );
    }

    const normalizedPhone = phoneNumber.replace(/-/g, "");
    const period = getCurrentPeriodKst();

    const { error: insertError } = await admin.from("reward_claims").upsert(
      {
        user_id: user.id,
        period,
        phone_number: normalizedPhone,
        privacy_consent: privacyConsent,
      },
      { onConflict: "user_id,period" }
    );

    if (insertError) {
      console.error("Reward claim insert error:", insertError);
      return NextResponse.json(
        { success: false, error: { code: "SERVER_ERROR", message: "저장에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { message: "보상 신청이 완료되었습니다." } });
  } catch (e) {
    console.error("Reward claim error:", e);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "처리 중 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
