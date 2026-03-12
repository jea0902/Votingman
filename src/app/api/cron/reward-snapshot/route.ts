/**
 * 매월 마지막 날 22:00 KST에 실행: user_stats MMR TOP 10 스냅샷
 *
 * - reward_snapshot에 period, user_id, rank 저장
 * - 이 스냅샷에 있는 유저만 보상 신청 가능 (다음날 10:00 KST까지)
 * - 마지막 날이 아니면 skipped 반환 (매일 22:00 KST 호출해도 됨)
 *
 * cron-job.org: 매일 22:00 KST (0 13 * * * UTC) - 마지막 날에만 실제 스냅샷
 * 인증: x-cron-secret / Authorization: Bearer / cron_secret
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { recordCronError } from "@/lib/monitor/cron-error-log";

const TOP_N = 10;
const JOB_NAME = "reward-snapshot";

function getSnapshotPeriodKst(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** KST 기준 오늘이 해당 월의 마지막 날인지 */
function isLastDayOfMonthKst(): boolean {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return d === lastDay;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!isLastDayOfMonthKst()) {
      return NextResponse.json({
        success: true,
        data: { skipped: true, reason: "마지막 날이 아님. 매월 마지막 날 22:00 KST에만 스냅샷 실행" },
      });
    }

    const period = getSnapshotPeriodKst();
    const admin = createSupabaseAdmin();

    const { data: statsRows, error: statsError } = await admin
      .from("user_stats")
      .select("user_id")
      .eq("market", "all")
      .order("mmr", { ascending: false })
      .limit(TOP_N);

    if (statsError || !statsRows || statsRows.length === 0) {
      await recordCronError(JOB_NAME, "SNAPSHOT_FAILED", statsError?.message ?? "TOP 10 조회 실패", { period });
      return NextResponse.json(
        { success: false, error: statsError?.message ?? "스냅샷 실패" },
        { status: 500 }
      );
    }

    const snapshotAt = new Date().toISOString();
    const rows = statsRows.map((r, i) => ({
      period,
      user_id: r.user_id,
      rank: i + 1,
      snapshot_at: snapshotAt,
    }));

    const { error: deleteError } = await admin.from("reward_snapshot").delete().eq("period", period);
    if (deleteError) {
      console.error("[cron/reward-snapshot] delete old error:", deleteError);
    }

    const { error: insertError } = await admin.from("reward_snapshot").insert(rows);

    if (insertError) {
      await recordCronError(JOB_NAME, "INSERT_FAILED", insertError.message, { period });
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { period, count: rows.length },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordCronError(JOB_NAME, "CRON_ERROR", msg, {});
    console.error("[cron/reward-snapshot]", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
