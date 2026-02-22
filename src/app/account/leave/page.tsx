import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import LeaveClient from "./LeaveClient";

export default async function LeavePage() {
  // 로그인 여부 확인
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/"); // 비로그인이면 홈으로 (로그인 페이지 경로 맞게 수정)
  }

  // 이미 탈퇴한 유저인지 확인
  const supabaseAdmin = createSupabaseAdmin();
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("deleted_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (userRow?.deleted_at) {
    redirect("/");
  }

  return <LeaveClient />;
}