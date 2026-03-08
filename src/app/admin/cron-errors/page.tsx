/**
 * /admin/cron-errors → /admin/cron-status 로 리다이렉트
 * 크론 에러 조회는 크론 상태 페이지에서 통합 제공
 */

import { redirect } from "next/navigation";

export default function AdminCronErrorsPage() {
  redirect("/admin/cron-status");
}
