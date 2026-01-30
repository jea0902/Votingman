import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnon } from "@/lib/supabase/server";

/**
 * 게시글 좋아요 토글 API
 * 
 * 설계 의도:
 * - POST: 좋아요 추가/제거 토글 (임시: user_id 고정)
 * - 중복 좋아요 방지 (PK 제약조건)
 * - 좋아요 수 자동 업데이트 (Trigger)
 */

type RouteContext = {
  params: Promise<{ id: string }>;
};

// =========================================
// POST /api/community/posts/[id]/like - 좋아요 토글
// =========================================
export async function POST(
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

    // 임시: user_id 고정 (인증 미구현)
    // TODO: 실제 인증 후 auth.uid() 사용
    const tempUserId = '00000000-0000-0000-0000-000000000000';

    const supabase = createSupabaseAnon();

    // 게시글 존재 확인
    const { data: post, error: postError } = await supabase
      .from('board_posts')
      .select('post_id, deleted_at')
      .eq('post_id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found.' },
        { status: 404 }
      );
    }

    if (post.deleted_at) {
      return NextResponse.json(
        { error: 'Cannot like deleted post.' },
        { status: 400 }
      );
    }

    // 기존 좋아요 확인
    const { data: existingLike } = await supabase
      .from('board_post_likes')
      .select('*')
      .eq('user_id', tempUserId)
      .eq('post_id', postId)
      .single();

    if (existingLike) {
      // 이미 좋아요 → 제거
      const { error: deleteError } = await supabase
        .from('board_post_likes')
        .delete()
        .eq('user_id', tempUserId)
        .eq('post_id', postId);

      if (deleteError) {
        console.error('Failed to remove like:', deleteError);
        return NextResponse.json(
          { error: 'Failed to remove like.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { 
          success: true,
          liked: false,
          message: 'Like removed.' 
        },
        { status: 200 }
      );
    } else {
      // 좋아요 없음 → 추가
      const { error: insertError } = await supabase
        .from('board_post_likes')
        .insert({
          user_id: tempUserId,
          post_id: postId,
        });

      if (insertError) {
        console.error('Failed to add like:', insertError);
        return NextResponse.json(
          { error: 'Failed to add like.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { 
          success: true,
          liked: true,
          message: 'Like added.' 
        },
        { status: 201 }
      );
    }

  } catch (error) {
    console.error('Unexpected error in POST /api/community/posts/[id]/like:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

// =========================================
// GET /api/community/posts/[id]/like - 좋아요 상태 확인
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

    // 임시: user_id 고정 (인증 미구현)
    const tempUserId = '00000000-0000-0000-0000-000000000000';

    const supabase = createSupabaseAnon();

    // 좋아요 확인
    const { data } = await supabase
      .from('board_post_likes')
      .select('*')
      .eq('user_id', tempUserId)
      .eq('post_id', postId)
      .single();

    return NextResponse.json({
      liked: !!data,
    }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error in GET /api/community/posts/[id]/like:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
