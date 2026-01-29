import "server-only";
import { createClient } from "@supabase/supabase-js";

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
