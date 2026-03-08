/**
 * 크론 인증: CRON_SECRET 환경변수
 * - Vercel 등에서 CRON_SECRET(언더스코어) 또는 CRON-SECRET(하이픈) 둘 다 지원
 */

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET ?? process.env["CRON-SECRET"];
}

export function isCronAuthorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return true;
  if (request.headers.get("x-cron-secret") === secret) return true;
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("cron_secret") === secret) return true;
  } catch {
    // ignore
  }
  return false;
}
