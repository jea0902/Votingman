/**
 * 버핏 원픽: 평가 실행 (전체, 오늘 날짜 / 새 run_id)
 * cron-job.org에서 매일 호출 (prices 수집 이후)
 * - Python: yf_result.py --mode full
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
    const result = await runBuffettScript("yf_result.py", ["--mode", "full"]);
    if (!result.ok) {
      console.error("[cron/buffett-result-full] stderr:", result.stderr);
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
        message: "buffett result full 완료",
        stdout: result.stdout,
      },
    });
  } catch (e) {
    console.error("[cron/buffett-result-full] error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
