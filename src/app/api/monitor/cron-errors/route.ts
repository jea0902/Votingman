/**
 * 크론 마지막 실패 에러 조회
 * cron-job.org 등은 500 응답 본문을 안 보여주므로, 실패 시 DB에 저장한 뒤 이 API로 확인
 *
 * GET /api/monitor/cron-errors
 * 인증: x-cron-secret (CRON_SECRET)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCronErrors } from "@/lib/monitor/cron-error-log";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const errors = await getCronErrors();
    return NextResponse.json({
      success: true,
      data: { errors },
    });
  } catch (e) {
    console.error("[monitor/cron-errors]", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
