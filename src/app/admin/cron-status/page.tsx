/**
 * 크론 상태 모니터: 실패 에러 + 미정산 폴 + 복구 실행
 * 관리자만 접근
 */

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CronStatusPanel } from "@/components/admin/CronStatusPanel";

export default async function AdminCronStatusPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: userData, error: roleError } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (roleError || !userData || userData.role !== "ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">크론 상태</h1>
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← 관리자 대시보드
        </a>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        실패 시 Vercel 로그 + 여기 DB 기록에서 원인 확인. 미정산 폴은 정산 실행으로 복구.
      </p>
      <CronStatusPanel />
    </div>
  );
}
