// 참고용 ( 미들웨어 수정 가이드 )

/**
 * middleware.ts 수정 가이드
 *
 * 탈퇴한 유저(deleted_at이 있는 유저)가 로그인 후 접근할 경우
 * 강제로 로그아웃 시키고 홈으로 리다이렉트합니다.
 *
 * 현재 미들웨어 코드에 아래 블록을 추가하세요.
 * (createSupabaseServerClient로 세션을 가져오는 부분 바로 다음에 삽입)
 */

// ─────────────────────────────────────────────────────────────
// 아래 import를 middleware.ts 상단에 추가
// ─────────────────────────────────────────────────────────────
import { createSupabaseAdmin } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────
// 미들웨어 함수 내부에 삽입할 코드
// 세션(user)을 확인한 직후에 추가하세요
// ─────────────────────────────────────────────────────────────

/*
  // 탈퇴 유저 차단
  if (user) {
    const supabaseAdmin = createSupabaseAdmin();
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("deleted_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (userRow?.deleted_at) {
      // 탈퇴된 계정이면 세션을 무효화하고 홈으로 리다이렉트
      const response = NextResponse.redirect(new URL("/", request.url));
      // Supabase 세션 쿠키 제거
      response.cookies.delete("sb-access-token");
      response.cookies.delete("sb-refresh-token");
      return response;
    }
  }
*/

// ─────────────────────────────────────────────────────────────
// 주의사항
// ─────────────────────────────────────────────────────────────
// - 미들웨어는 모든 요청마다 실행되므로 DB 조회가 부담될 수 있음
// - 최적화가 필요하면 탈퇴 API에서 Response 쿠키에 "withdrawn=true"를
//   짧게 심고, 미들웨어는 해당 쿠키만 체크하는 방식도 가능
// - 혹은 보호된 경로(/account, /mypage 등)에서만 체크하도록
//   matcher config를 좁히는 것을 권장