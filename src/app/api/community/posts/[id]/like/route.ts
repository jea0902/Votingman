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

    // 사용자 식별 (로그인 사용자 또는 익명)
    const body = await request.json();
    const { user_id, action } = body;

    const supabase = createSupabaseAnon();

    // 게시글 존재 확인
    const { data: post, error: postError } = await supabase
      .from('board_posts')
      .select('post_id, deleted_at, like_count')
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

    // 비회원인 경우: like_count만 증가/감소 (LocalStorage로 중복 방지)
    if (!user_id) {
      if (action === 'unlike') {
        // 좋아요 취소: like_count 감소
        const { error: updateError } = await supabase
          .from('board_posts')
          .update({ like_count: Math.max(0, (post.like_count || 0) - 1) })
          .eq('post_id', postId);

        if (updateError) {
          console.error('Failed to update like count:', updateError);
          return NextResponse.json(
            { error: 'Failed to update like.' },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { success: true, liked: false, message: 'Like removed.' },
          { status: 200 }
        );
      } else {
        // 좋아요: like_count 증가
        const { error: updateError } = await supabase
          .from('board_posts')
          .update({ like_count: (post.like_count || 0) + 1 })
          .eq('post_id', postId);

        if (updateError) {
          console.error('Failed to update like count:', updateError);
          return NextResponse.json(
            { error: 'Failed to update like.' },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { success: true, liked: true, message: 'Like added.' },
          { status: 201 }
        );
      }
    }

    // 로그인 사용자: 기존 좋아요 확인 후 토글
    const { data: existingLike } = await supabase
      .from('board_post_likes')
      .select('*')
      .eq('user_id', user_id)
      .eq('post_id', postId)
      .single();

    if (existingLike) {
      // 이미 좋아요 → 제거
      const { error: deleteError } = await supabase
        .from('board_post_likes')
        .delete()
        .eq('user_id', user_id)
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
          user_id: user_id,
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

    // 사용자 식별 (로그인 사용자 또는 익명)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    
    // 익명 사용자는 고정 UUID 사용
    const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000';
    const finalUserId = userId || ANONYMOUS_USER_ID;

    const supabase = createSupabaseAnon();

    // 좋아요 확인
    const { data } = await supabase
      .from('board_post_likes')
      .select('*')
      .eq('user_id', finalUserId)
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
