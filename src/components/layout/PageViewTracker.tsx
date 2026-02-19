"use client";

/**
 * PageViewTracker — 페이지 진입 시 pageview 로그
 *
 * 설계 의도:
 * - pathname 변경 시 POST /api/analytics/pageview 호출
 * - 관리자 대시보드 "오늘 페이지뷰" 집계용
 * - /admin 경로는 제외 (관리자 진입은 유효 페이지뷰가 아님)
 */
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function PageViewTracker() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === prevPathRef.current || pathname.startsWith("/admin")) return;
    prevPathRef.current = pathname;

    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
