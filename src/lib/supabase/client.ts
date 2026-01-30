import { createBrowserClient } from "@supabase/ssr";

/**
 * 클라이언트(브라우저) 전용 Supabase 클라이언트
 * 
 * 설계 의도:
 * - 브라우저에서 Auth, Storage 등 접근
 * - NEXT_PUBLIC_ 환경변수만 사용 (안전)
 * - 세션 자동 관리
 * 
 * 보안:
 * - Service Role Key는 절대 사용 안 함
 * - Anon Key만 사용 (Public)
 */

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
