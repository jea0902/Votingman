/**
 * 로컬 디버그용: backfill-and-settle 1건 실행 후 결과/에러 그대로 반환 (500 원인 확인)
 * GET /api/admin/backfill-and-settle-debug?pollId=xxx
 * Header: x-cron-secret (CRON_SECRET)
 * 로컬에서만 사용: npm run dev → 이 URL 호출
 */

import { NextRequest, NextResponse } from "next/server";
import { backfillAndSettlePoll } from "@/lib/sentiment/settlement-service";
import { isCronAuthorized } from "@/lib/cron/auth";

function isCronSecretAuth(request: NextRequest): boolean {
  return isCronAuthorized(request);
}

export async function GET(request: NextRequest) {
  if (!isCronSecretAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const pollId = request.nextUrl.searchParams.get("pollId")?.trim();
  if (!pollId) {
    return NextResponse.json(
      { success: false, error: "pollId 쿼리 필요. 예: ?pollId=893bc11d-..." },
      { status: 400 }
    );
  }

  try {
    const result = await backfillAndSettlePoll(pollId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[backfill-and-settle-debug]", err);
    return NextResponse.json(
      { success: false, error: message, stack },
      { status: 500 }
    );
  }
}
