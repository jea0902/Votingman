/**
 * 크론 실패 시 에러 저장 / 모니터 API에서 조회
 * cron-job.org 등은 500 응답 본문을 보여주지 않으므로 DB에 남겨 둠
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";

export type CronErrorEntry = {
  job_name: string;
  error_code: string;
  error_message: string;
  created_at: string;
};

export async function recordCronError(
  jobName: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  const admin = createSupabaseAdmin();
  await admin.from("cron_error_log").upsert(
    {
      job_name: jobName,
      error_code: errorCode,
      error_message: errorMessage,
      created_at: new Date().toISOString(),
    },
    { onConflict: "job_name" }
  );
}

export async function getCronErrors(): Promise<CronErrorEntry[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("cron_error_log")
    .select("job_name, error_code, error_message, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getCronError(jobName: string): Promise<CronErrorEntry | null> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("cron_error_log")
    .select("job_name, error_code, error_message, created_at")
    .eq("job_name", jobName)
    .maybeSingle();
  if (error || !data) return null;
  return data as CronErrorEntry;
}
