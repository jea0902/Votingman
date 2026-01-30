import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * 서버 전용 Supabase 클라이언트
 * - service_role 키는 절대 클라이언트에 노출 금지
 * - env 누락 시 즉시 에러 발생
 */
const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const createSupabaseAdmin = () =>
  createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

export const createSupabaseAnon = () =>
  createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } }
  );

/**
 * 서버 사이드 Auth용 Supabase 클라이언트 (쿠키 지원)
 * 
 * 설계 의도:
 * - Route Handler에서 OAuth 콜백 처리
 * - 쿠키를 통한 세션 관리
 * - PKCE (code verifier) 자동 처리
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Route Handler에서는 쿠키 설정이 제한될 수 있음
          }
        },
      },
    }
  );
}
