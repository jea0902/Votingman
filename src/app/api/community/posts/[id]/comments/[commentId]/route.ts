/**
 * 댓글 수정/삭제 API
 * 
 * 설계 의도:
 * - PUT: 댓글 내용 수정 (본인 또는 관리자)
 * - DELETE: 댓글 삭제 - Soft Delete (본인 또는 관리자)
 * 
 * 보안:
 * - 서버에서 세션 확인
 * - 본인 댓글 또는 관리자만 수정/삭제 가능
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{
    id: string;       // post_id
    commentId: string; // comment_id
  }>;
}

/**
 * PUT: 댓글 수정
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id: postId, commentId } = await params;
    const supabase = await createSupabaseServerClient();

    // 1. 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' } },
        { status: 401 }
      );
    }

    // 2. 사용자 정보 조회 (role 확인)
    const { data: userData } = await supabase
      .from('users')
      .select('user_id, role')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: '사용자 정보를 찾을 수 없습니다' } },
        { status: 404 }
      );
    }

    // 3. 댓글 조회 및 권한 확인
    const { data: comment, error: commentError } = await supabase
      .from('board_comments')
      .select('comment_id, user_id, post_id')
      .eq('comment_id', commentId)
      .eq('post_id', postId)
      .is('deleted_at', null)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '댓글을 찾을 수 없습니다' } },
        { status: 404 }
      );
    }

    // 4. 권한 확인: 본인 또는 관리자
    const isOwner = comment.user_id === user.id;
    const isAdmin = userData.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: '수정 권한이 없습니다' } },
        { status: 403 }
      );
    }

    // 5. 요청 데이터 파싱
    const body = await request.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '댓글 내용을 입력해주세요' } },
        { status: 400 }
      );
    }

    // 6. 댓글 수정
    const { data: updatedComment, error: updateError } = await supabase
      .from('board_comments')
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('comment_id', commentId)
      .select()
      .single();

    if (updateError) {
      console.error('Comment update error:', updateError);
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: '댓글 수정에 실패했습니다' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { comment: updatedComment },
    });

  } catch (error) {
    console.error('Comment PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 댓글 삭제 (Soft Delete)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: postId, commentId } = await params;
    const supabase = await createSupabaseServerClient();

    // 1. 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' } },
        { status: 401 }
      );
    }

    // 2. 사용자 정보 조회 (role 확인)
    const { data: userData } = await supabase
      .from('users')
      .select('user_id, role')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: '사용자 정보를 찾을 수 없습니다' } },
        { status: 404 }
      );
    }

    // 3. 댓글 조회 및 권한 확인
    const { data: comment, error: commentError } = await supabase
      .from('board_comments')
      .select('comment_id, user_id, post_id')
      .eq('comment_id', commentId)
      .eq('post_id', postId)
      .is('deleted_at', null)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '댓글을 찾을 수 없습니다' } },
        { status: 404 }
      );
    }

    // 4. 권한 확인: 본인 또는 관리자
    const isOwner = comment.user_id === user.id;
    const isAdmin = userData.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: '삭제 권한이 없습니다' } },
        { status: 403 }
      );
    }

    // 5. Soft Delete
    const { error: deleteError } = await supabase
      .from('board_comments')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('comment_id', commentId);

    if (deleteError) {
      console.error('Comment delete error:', deleteError);
      return NextResponse.json(
        { success: false, error: { code: 'DELETE_FAILED', message: '댓글 삭제에 실패했습니다' } },
        { status: 500 }
      );
    }

    // 6. 게시글의 comment_count 감소
    const { data: postData } = await supabase
      .from('board_posts')
      .select('comment_count')
      .eq('post_id', postId)
      .single();
    
    if (postData && postData.comment_count > 0) {
      await supabase
        .from('board_posts')
        .update({ comment_count: postData.comment_count - 1 })
        .eq('post_id', postId);
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });

  } catch (error) {
    console.error('Comment DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다' } },
      { status: 500 }
    );
  }
}
