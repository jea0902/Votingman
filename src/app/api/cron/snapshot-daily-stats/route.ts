/**
 * 매일 KST 23:59에 실행: 전일 활성 유저·투표 수 집계
 *
 * - users.last_active_at: 해당 일(KST)에 활성인 유저 수 (deleted_at 제외)
 * - sentiment_votes.created_at: 해당 일(KST) 투표 건수
 * - active_users_state에 upsert
 *
 * cron-job.org: 매일 23:59 KST
 * 인증: x-cron-secret / Authorization: Bearer / cron_secret 쿼리
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { recordCronError } from "@/lib/monitor/cron-error-log";

function getKstDateRange(statDate: string): { startAt: string; endAt: string } {
  const startAt = `${statDate}T00:00:00+09:00`;
  const [y, m, d] = statDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const endDateStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  const endAt = `${endDateStr}T00:00:00+09:00`;
  return { startAt, endAt };
}

function getTodayKstDate(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date()).replace(/\//g, "-");
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const JOB_NAME = "snapshot-daily-stats";

  try {
    const statDate = getTodayKstDate();
    const { startAt, endAt } = getKstDateRange(statDate);

    const admin = createSupabaseAdmin();

    const [activeRes, voteRes] = await Promise.all([
      admin
        .from("users")
        .select("user_id", { count: "exact", head: true })
        .gte("last_active_at", startAt)
        .lt("last_active_at", endAt)
        .is("deleted_at", null),
      admin
        .from("sentiment_votes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startAt)
        .lt("created_at", endAt),
    ]);

    const activeUserCount = activeRes.count ?? 0;
    const voteCount = voteRes.count ?? 0;

    const { error } = await admin.from("active_users_state").upsert(
      {
        stat_date: statDate,
        active_user_count: activeUserCount,
        vote_count: voteCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stat_date" }
    );

    if (error) {
      await recordCronError(JOB_NAME, "UPSERT_FAILED", error.message, { statDate, activeUserCount, voteCount });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { stat_date: statDate, active_user_count: activeUserCount, vote_count: voteCount },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordCronError(JOB_NAME, "CRON_ERROR", msg, {});
    console.error("[cron/snapshot-daily-stats]", err);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
