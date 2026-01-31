/**
 * 건의/설문 페이지 → 커뮤니티로 리다이렉트
 *
 * 설계 의도:
 * - 기존 /suggestions 경로로 접근 시 /community로 리다이렉트
 * - 하위 호환성 유지 및 SEO 고려
 */

import { redirect } from "next/navigation";

export default function SuggestionsPage() {
  // /community로 영구 리다이렉트 (308 Permanent Redirect)
  redirect("/community");
}
