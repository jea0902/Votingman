/**
 * 유틸리티: cn (className merge)
 *
 * 설계 의도:
 * - shadcn/ui 스타일 조합을 위한 class 병합 유틸
 * - tailwind-merge로 충돌 제거, clsx로 조건부 클래스 처리
 * - 컴포넌트 variant 오버라이드 및 조합에 사용
 *
 * @param inputs - 클래스 문자열 또는 조건부 객체
 * @returns 병합된 Tailwind 클래스 문자열
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
