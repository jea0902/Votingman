/**
 * 랜딩 페이지 (/landing)
 *
 * 로그인 여부와 관계없이 항상 랜딩 콘텐츠 표시.
 * 로고 클릭 시 홈으로 돌아갈 수 있도록 제공.
 */

import { LandingSection } from "@/components/landing/LandingSection";

export default function LandingPage() {
  return <LandingSection />;
}
