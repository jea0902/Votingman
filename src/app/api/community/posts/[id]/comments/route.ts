import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnon } from "@/lib/supabase/server";

/**
 * 댓글 API Routes
 * 
 * 설계 의도:
 * - POST: 댓글 작성 (임시: 작성자 닉네임 수동 입력)
 * - GET: 댓글 목록 조회 (대댓글 포함, 정렬)
 * 
 * 기능:
 * - 댓글/대댓글 구분 (depth: 0 or 1)
 * - 작성자 닉네임 캐싱
 * - 댓글 작성 시 게시글 comment_count 자동 증가 (Trigger)
 */

type RouteContext = {
  params: Promise<{ id: string }>;
};

// =========================================
// POST /api/community/posts/[id]/comments - 댓글 작성
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

    const body = await request.json();
    const { content, author_name, parent_comment_id } = body;

    // 입력 검증
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required.' },
        { status: 400 }
      );
    }

    if (!author_name || author_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Author name is required.' },
        { status: 400 }
      );
    }

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
        { error: 'Cannot comment on deleted post.' },
        { status: 400 }
      );
    }

    // 대댓글인 경우 부모 댓글 확인
    let depth = 0;
    if (parent_comment_id) {
      const parentId = parseInt(parent_comment_id, 10);
      
      if (isNaN(parentId)) {
        return NextResponse.json(
          { error: 'Invalid parent comment ID.' },
          { status: 400 }
        );
      }

      const { data: parentComment, error: parentError } = await supabase
        .from('board_comments')
        .select('comment_id, depth, deleted_at')
        .eq('comment_id', parentId)
        .eq('post_id', postId)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json(
          { error: 'Parent comment not found.' },
          { status: 404 }
        );
      }

      if (parentComment.deleted_at) {
        return NextResponse.json(
          { error: 'Cannot reply to deleted comment.' },
          { status: 400 }
        );
      }

      // 대댓글은 1단계까지만
      if (parentComment.depth >= 1) {
        return NextResponse.json(
          { error: 'Cannot create nested replies beyond 1 level.' },
          { status: 400 }
        );
      }

      depth = 1;
    }

    // HTML 태그 제거 (XSS 방지)
    const sanitizedContent = content.replace(/<script[^>]*>.*?<\/script>/gi, '').trim();
    const sanitizedAuthorName = author_name.replace(/<[^>]*>/g, '').trim();

    // 임시: user_id는 고정값 (인증 미구현)
    const tempUserId = '00000000-0000-0000-0000-000000000000';

    // 댓글 저장
    const { data, error } = await supabase
      .from('board_comments')
      .insert({
        post_id: postId,
        user_id: tempUserId,
        content: sanitizedContent,
        author_name: sanitizedAuthorName,
        parent_comment_id: parent_comment_id ? parseInt(parent_comment_id, 10) : null,
        depth,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create comment:', error);
      return NextResponse.json(
        { error: 'Failed to create comment.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: true,
        comment: data 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error in POST /api/community/posts/[id]/comments:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

// =========================================
// GET /api/community/posts/[id]/comments - 댓글 목록 조회
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

    // 댓글 목록 조회 (소프트 삭제 제외, 오래된 순)
    const { data, error } = await supabase
      .from('board_comments')
      .select('*')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }); // 오래된 순

    if (error) {
      console.error('Failed to fetch comments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch comments.' },
        { status: 500 }
      );
    }

    // 댓글을 부모-자식 구조로 변환
    const comments = data || [];
    const topLevelComments = comments.filter(c => c.depth === 0);
    const replies = comments.filter(c => c.depth === 1);

    const commentsWithReplies = topLevelComments.map(comment => ({
      ...comment,
      replies: replies.filter(r => r.parent_comment_id === comment.comment_id),
    }));

    return NextResponse.json({
      comments: commentsWithReplies,
      total_count: comments.length,
    }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error in GET /api/community/posts/[id]/comments:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
