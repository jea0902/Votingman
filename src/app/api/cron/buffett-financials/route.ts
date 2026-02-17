/**
 * 버핏 원픽: 재무제표 수집 (연 1회)
 * cron-job.org에서 연 1회 호출
 * - Python: yf_data_collect.py --mode financials
 * - Vercel에서는 Python 미지원 → Python 있는 서버에서만 사용
 */

import { NextResponse } from "next/server";
import {
  runBuffettScript,
  isCronAuthorized,
} from "@/lib/cron/run-buffett-script";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await runBuffettScript("yf_data_collect.py", [
      "--mode",
      "financials",
    ]);
    if (!result.ok) {
      console.error("[cron/buffett-financials] stderr:", result.stderr);
      return NextResponse.json(
        {
          success: false,
          error: "Script failed",
          code: result.code,
          stderr: result.stderr,
          stdout: result.stdout,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        message: "buffett financials 수집 완료",
        stdout: result.stdout,
      },
    });
  } catch (e) {
    console.error("[cron/buffett-financials] error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
