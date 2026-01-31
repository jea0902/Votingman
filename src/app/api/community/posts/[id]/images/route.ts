import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnon } from "@/lib/supabase/server";

/**
 * 게시글 이미지 API
 * 
 * 설계 의도:
 * - GET: 특정 게시글의 첨부 이미지 목록 조회
 * 
 * 보안:
 * - SQL Injection: Supabase 파라미터화 쿼리로 방어
 * 
 * 확장성:
 * - 이미지 삭제 기능 추가 가능
 */

type RouteContext = {
  params: Promise<{ id: string }>;
};

// =========================================
// GET /api/community/posts/[id]/images - 이미지 목록 조회
// =========================================
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const postId = parseInt(id, 10);

    if (isNaN(postId)) {
      return NextResponse.json(
        { error: 'Invalid post ID.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAnon();

    // board_images 테이블에서 이미지 조회
    const { data, error } = await supabase
      .from('board_images')
      .select('image_id, image_url, sort_order')
      .eq('post_id', postId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch images:', error);
      return NextResponse.json(
        { error: 'Failed to fetch images.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { images: data || [] },
      { status: 200 }
    );

  } catch (err) {
    console.error('Unexpected error in GET /api/community/posts/[id]/images:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
