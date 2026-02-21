/**
 * GET /api/profile - 로그인 사용자 개인정보 조회
 * PATCH /api/profile - 닉네임 수정 (중복·유효성 검사 후)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 10;
const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9]+$/;
/** 닉네임 변경 후 재변경 가능까지 일수 */
const NICKNAME_CHANGE_COOLDOWN_DAYS = 7;

export async function GET() {
  try {
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        },
        { status: 401 }
      );
    }

    const admin = createSupabaseAdmin();
    const { data: row, error } = await admin
      .from("users")
      .select("email, nickname, created_at, voting_coin_balance, nickname_updated_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("[profile] GET error:", error);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    if (!row) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "사용자 정보를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    const nicknameUpdatedAt = row.nickname_updated_at ?? null;
    let nextChangeAllowedAt: string | null = null;
    if (nicknameUpdatedAt) {
      const updated = new Date(nicknameUpdatedAt);
      updated.setDate(updated.getDate() + NICKNAME_CHANGE_COOLDOWN_DAYS);
      nextChangeAllowedAt = updated.toISOString();
    }

    return NextResponse.json({
      success: true,
      data: {
        email: row.email ?? "",
        nickname: row.nickname ?? "",
        created_at: row.created_at ?? null,
        voting_coin_balance: row.voting_coin_balance != null ? Number(row.voting_coin_balance) : 0,
        nickname_updated_at: nicknameUpdatedAt,
        next_change_allowed_at: nextChangeAllowedAt,
      },
    });
  } catch (err) {
    console.error("[profile] GET unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        },
        { status: 401 }
      );
    }

    let body: { nickname?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "요청 형식이 올바르지 않습니다." },
        },
        { status: 400 }
      );
    }

    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
    if (!nickname) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "닉네임을 입력해주세요." },
        },
        { status: 400 }
      );
    }

    if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: `닉네임은 ${NICKNAME_MIN}-${NICKNAME_MAX}자로 입력해주세요.` },
        },
        { status: 400 }
      );
    }

    if (!NICKNAME_PATTERN.test(nickname)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "닉네임은 한글, 영어, 숫자만 사용할 수 있습니다." },
        },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    // 일주일 제한: nickname_updated_at 확인
    const { data: currentRow } = await admin
      .from("users")
      .select("nickname_updated_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    const updatedAt = currentRow?.nickname_updated_at;
    if (updatedAt) {
      const allowedAt = new Date(updatedAt);
      allowedAt.setDate(allowedAt.getDate() + NICKNAME_CHANGE_COOLDOWN_DAYS);
      if (new Date() < allowedAt) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "COOLDOWN",
              message: `닉네임은 변경 후 ${NICKNAME_CHANGE_COOLDOWN_DAYS}일이 지나야 다시 변경할 수 있습니다.`,
              next_change_allowed_at: allowedAt.toISOString(),
            },
          },
          { status: 400 }
        );
      }
    }

    // 닉네임 중복 체크 (현재 사용자 제외)
    const { data: existing } = await admin
      .from("users")
      .select("user_id")
      .eq("nickname", nickname)
      .neq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "이미 사용 중인 닉네임입니다." },
        },
        { status: 400 }
      );
    }

    const { error: updateError } = await admin
      .from("users")
      .update({ nickname, nickname_updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (updateError) {
      console.error("[profile] PATCH update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "닉네임 수정에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    const now = new Date();
    const nextAllowed = new Date(now);
    nextAllowed.setDate(nextAllowed.getDate() + NICKNAME_CHANGE_COOLDOWN_DAYS);

    return NextResponse.json({
      success: true,
      data: {
        nickname,
        nickname_updated_at: now.toISOString(),
        next_change_allowed_at: nextAllowed.toISOString(),
      },
    });
  } catch (err) {
    console.error("[profile] PATCH unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
