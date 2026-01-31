import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnon } from "@/lib/supabase/server";
import type { PostListResponse, PostListItem } from "@/lib/supabase/db-types";

/**
 * 실시간 베스트 게시글 API
 * 
 * 설계 의도:
 * - 좋아요와 조회수가 높은 인기 게시글 모아보기
 * - 일간 베스트: 24시간 이내 작성 + 좋아요 5개 이상 + 조회수 30회 이상
 * - 주간 베스트: 7일 이내 작성 + 좋아요 15개 이상 + 조회수 100회 이상
 * 
 * 보안:
 * - SQL Injection: Supabase 파라미터화 쿼리로 방어
 * - 삭제된 게시글 제외 (deleted_at IS NULL)
 * 
 * 확장성:
 * - 점수 기반 알고리즘으로 변경 가능
 * - 카테고리별 베스트 분리 가능
 */

// =========================================
// GET /api/community/posts/best - 실시간 베스트 목록
// =========================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('page_size') || '20', 10);
    const period = searchParams.get('period') || 'daily'; // daily or weekly

    // 페이지 검증
    if (page < 1) {
      return NextResponse.json(
        { error: 'Page must be greater than 0.' },
        { status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: 'Page size must be between 1 and 100.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAnon();

    // 기준 설정
    let minLikes = 5;
    let minViews = 30;
    let hoursAgo = 24;

    if (period === 'weekly') {
      minLikes = 15;
      minViews = 100;
      hoursAgo = 24 * 7;
    }

    // 기준 시간 계산
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);
    const cutoffISO = cutoffDate.toISOString();

    // 전체 개수 조회 (페이지네이션용)
    const { count, error: countError } = await supabase
      .from('board_posts')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', cutoffISO)
      .gte('like_count', minLikes)
      .gte('view_count', minViews);

    if (countError) {
      console.error('Failed to count best posts:', countError);
      return NextResponse.json(
        { error: 'Failed to count posts.' },
        { status: 500 }
      );
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;

    // 게시글 조회
    const { data, error } = await supabase
      .from('board_posts')
      .select('post_id, board_type, category, title, author_name, view_count, like_count, comment_count, is_pinned, is_admin_post, created_at')
      .is('deleted_at', null)
      .gte('created_at', cutoffISO)
      .gte('like_count', minLikes)
      .gte('view_count', minViews)
      .order('like_count', { ascending: false })
      .order('view_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Failed to fetch best posts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch best posts.' },
        { status: 500 }
      );
    }

    const response: PostListResponse = {
      posts: data as PostListItem[],
      total_count: totalCount,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (err) {
    console.error('Unexpected error in GET /api/community/posts/best:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
