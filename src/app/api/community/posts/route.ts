import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnon, createSupabaseAdmin } from "@/lib/supabase/server";
import type { 
  CreatePostRequest, 
  PostListResponse,
  PostListItem 
} from "@/lib/supabase/db-types";

/**
 * 게시글 API Routes
 * 
 * 설계 의도:
 * - POST: 게시글 작성 (임시: 인증 없이 author_name 수동 입력)
 * - GET: 게시글 목록 조회 (필터링, 페이지네이션)
 * 
 * 보안:
 * - XSS 방지: 입력값 검증 및 sanitization
 * - SQL Injection: Supabase 파라미터화 쿼리로 방어
 * - Rate Limiting: 추후 추가 예정
 * 
 * 확장성:
 * - 인증 추가 시 author_name 대신 user_id로 자동 처리
 * - RLS 정책으로 권한 제어 강화
 */

// =========================================
// POST /api/community/posts - 게시글 작성
// =========================================
export async function POST(request: NextRequest) {
  try {
    // FormData로 받기 (이미지 파일 포함)
    const formData = await request.formData();
    const board_type = formData.get('board_type') as string;
    const category = formData.get('category') as string | null;
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const user_id = formData.get('user_id') as string;
    const author_name = formData.get('author_name') as string;
    const imageFiles = formData.getAll('images') as File[];

    // 입력 검증
    if (!board_type || !['free', 'perspective'].includes(board_type)) {
      return NextResponse.json(
        { error: 'Invalid board_type. Must be "free" or "perspective".' },
        { status: 400 }
      );
    }

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required.' },
        { status: 400 }
      );
    }

    if (title.length > 300) {
      return NextResponse.json(
        { error: 'Title must be less than 300 characters.' },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required.' },
        { status: 400 }
      );
    }

    if (!user_id || user_id.trim().length === 0) {
      return NextResponse.json(
        { error: 'User ID is required. Please login first.' },
        { status: 401 }
      );
    }

    if (!author_name || author_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Author name is required.' },
        { status: 400 }
      );
    }

    // 자유게시판은 카테고리 필수
    if (board_type === 'free') {
      if (!category || !['free', 'suggestion'].includes(category)) {
        return NextResponse.json(
          { error: 'Category is required for free board. Must be "free" or "suggestion".' },
          { status: 400 }
        );
      }
    }

    // 관점 게시판은 카테고리 없음
    const finalCategory = board_type === 'perspective' ? null : category;

    // HTML 태그 제거 (XSS 방지)
    const sanitizedTitle = title.replace(/<[^>]*>/g, '').trim();
    const sanitizedContent = content.replace(/<script[^>]*>.*?<\/script>/gi, '').trim();
    const sanitizedAuthorName = author_name.replace(/<[^>]*>/g, '').trim();

    // Supabase에 게시글 저장
    const supabase = createSupabaseAnon();

    const { data, error } = await supabase
      .from('board_posts')
      .insert({
        user_id: user_id,
        board_type,
        category: finalCategory,
        title: sanitizedTitle,
        content: sanitizedContent,
        author_name: sanitizedAuthorName,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create post:', error);
      return NextResponse.json(
        { error: 'Failed to create post. Please try again.' },
        { status: 500 }
      );
    }

    const postId = data.post_id;

    // 이미지 업로드 처리 (Service Role 사용)
    if (imageFiles && imageFiles.length > 0) {
      const imageUrls: { image_url: string; sort_order: number }[] = [];
      
      // Storage 업로드는 Admin 클라이언트 사용 (RLS 우회)
      const supabaseAdmin = createSupabaseAdmin();

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        
        // 파일 타입 검증
        if (!file.type.startsWith('image/')) {
          console.warn(`Skipping non-image file: ${file.name}`);
          continue;
        }

        // 파일 크기 검증 (5MB)
        if (file.size > 5 * 1024 * 1024) {
          console.warn(`Skipping large file (>5MB): ${file.name}`);
          continue;
        }

        try {
          // Supabase Storage에 업로드 (Service Role로 RLS 우회)
          const fileExt = file.name.split('.').pop();
          const fileName = `${postId}_${i}_${Date.now()}.${fileExt}`;
          const filePath = `community/${fileName}`;

          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('board_images')
            .upload(filePath, buffer, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) {
            console.error('Image upload error:', uploadError);
            continue;
          }

          // Public URL 생성
          const { data: { publicUrl } } = supabaseAdmin.storage
            .from('board_images')
            .getPublicUrl(filePath);

          imageUrls.push({
            image_url: publicUrl,
            sort_order: i,
          });
        } catch (imgError) {
          console.error('Image processing error:', imgError);
        }
      }

      // board_images 테이블에 저장
      if (imageUrls.length > 0) {
        const imageRecords = imageUrls.map(img => ({
          post_id: postId,
          image_url: img.image_url,
          sort_order: img.sort_order,
        }));

        const { error: imageInsertError } = await supabase
          .from('board_images')
          .insert(imageRecords);

        if (imageInsertError) {
          console.error('Image metadata insert error:', imageInsertError);
          // 에러가 나도 게시글은 성공으로 처리 (이미지는 선택 사항)
        }
      }
    }

    return NextResponse.json(
      { 
        success: true,
        post: data 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error in POST /api/community/posts:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

// =========================================
// GET /api/community/posts - 게시글 목록 조회
// =========================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 쿼리 파라미터 파싱
    const board_type = searchParams.get('board_type') as 'free' | 'perspective' | null;
    const category = searchParams.get('category') as 'free' | 'suggestion' | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const page_size = Math.min(50, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)));

    // 입력 검증
    if (board_type && !['free', 'perspective'].includes(board_type)) {
      return NextResponse.json(
        { error: 'Invalid board_type.' },
        { status: 400 }
      );
    }

    if (category && !['free', 'suggestion'].includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAnon();

    // 쿼리 빌더 시작
    let query = supabase
      .from('board_posts')
      .select('post_id, board_type, category, title, author_name, view_count, like_count, comment_count, is_pinned, is_admin_post, created_at', { count: 'exact' })
      .is('deleted_at', null); // 소프트 삭제 제외

    // 필터링
    if (board_type) {
      query = query.eq('board_type', board_type);
    }

    if (category) {
      query = query.eq('category', category);
    }

    // 정렬: 고정 게시글 우선, 그 다음 최신순
    query = query.order('is_pinned', { ascending: false });
    query = query.order('created_at', { ascending: false });

    // 페이지네이션
    const from = (page - 1) * page_size;
    const to = from + page_size - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to fetch posts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch posts.' },
        { status: 500 }
      );
    }

    const total_count = count || 0;
    const total_pages = Math.ceil(total_count / page_size);

    const response: PostListResponse = {
      posts: data as PostListItem[],
      total_count,
      page,
      page_size,
      total_pages,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Unexpected error in GET /api/community/posts:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
