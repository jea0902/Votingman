/**
 * 관리자 대시보드
 *
 * 설계 의도:
 * - /admin 접근 시에만 role 확인
 * - 관리자만 접근 가능
 * - 최근 5분 내 활성 유저 수 표시
 */

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
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
    redirect("/home");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-foreground">관리자 대시보드</h1>
      <AdminDashboard />
    </div>
  );
}
