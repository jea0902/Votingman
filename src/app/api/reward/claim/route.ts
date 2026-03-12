/**
 * POST /api/reward/claim
 * TOP 10 보상(선물하기 3만원권) 수령 신청
 * - 신청 기간: 월말 22:00 KST ~ 다음날 10:00 KST
 * - reward_snapshot에 있는 유저만 신청 가능 (월말 22:00 스냅샷 기준)
 * - reward_claims에 period, 휴대폰 번호, 개인정보 동의, rank 저장
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { getClaimablePeriodKst } from "@/lib/reward/claim-window";

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

    const period = getClaimablePeriodKst();
    if (!period) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "보상 신청 기간이 아닙니다. (월말 22:00 ~ 다음날 10:00 KST)" } },
        { status: 403 }
      );
    }

    const admin = createSupabaseAdmin();

    const { data: snapshotRow, error: snapshotError } = await admin
      .from("reward_snapshot")
      .select("rank")
      .eq("period", period)
      .eq("user_id", user.id)
      .maybeSingle();

    if (snapshotError || !snapshotRow) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "해당 월 스냅샷 TOP 10에 포함된 유저만 보상을 신청할 수 있습니다." } },
        { status: 403 }
      );
    }

    const rank = snapshotRow.rank;
    const normalizedPhone = phoneNumber.replace(/-/g, "");

    const { error: insertError } = await admin.from("reward_claims").upsert(
      {
        user_id: user.id,
        period,
        phone_number: normalizedPhone,
        privacy_consent: privacyConsent,
        rank,
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
