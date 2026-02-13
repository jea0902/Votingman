/**
 * 루트 페이지 (/)
 *
 * - 비로그인: 랜딩 페이지 (도발적 문구, 서비스 강점)
 * - 로그인: 홈 메인 (투표, 포지션 등)
 */

import { PageSwitcher } from "@/components/home/PageSwitcher";

export default function Home() {
  return <PageSwitcher />;
}
