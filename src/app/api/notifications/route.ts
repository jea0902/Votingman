import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 알림 목록 조회 API
 * 
 * GET /api/notifications?limit=10&offset=0
 * - 현재 로그인 사용자의 알림 목록 조회
 * - 최신순 정렬
 * - 페이지네이션 지원
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // 현재 로그인 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('알림 API: 인증 실패 - 401 반환');
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    // 알림 목록 조회
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (notificationsError) {
      console.error('Failed to fetch notifications:', notificationsError);
      return NextResponse.json(
        { error: "알림 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    // 읽지 않은 알림 수 조회
    const { count: unreadCount, error: countError } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (countError) {
      console.error('Failed to count unread notifications:', countError);
    }

    return NextResponse.json({
      success: true,
      data: {
        notifications: notifications || [],
        unread_count: unreadCount || 0,
        total_count: notifications?.length || 0,
        has_more: (notifications?.length || 0) === limit
      }
    });

  } catch (err) {
    console.error('Notifications API error:', err);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 알림 읽음 처리 API
 * 
 * PATCH /api/notifications
 * Body: { notification_id: string } | { mark_all_read: true }
 */

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // 현재 로그인 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { notification_id, mark_all_read } = await request.json();

    if (mark_all_read) {
      // 모든 알림 읽음 처리
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (updateError) {
        console.error('Failed to mark all notifications as read:', updateError);
        return NextResponse.json(
          { error: "알림 읽음 처리에 실패했습니다." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "모든 알림이 읽음 처리되었습니다."
      });

    } else if (notification_id) {
      // 특정 알림 읽음 처리
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notification_id)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Failed to mark notification as read:', updateError);
        return NextResponse.json(
          { error: "알림 읽음 처리에 실패했습니다." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "알림이 읽음 처리되었습니다."
      });

    } else {
      return NextResponse.json(
        { error: "notification_id 또는 mark_all_read가 필요합니다." },
        { status: 400 }
      );
    }

  } catch (err) {
    console.error('Notification update API error:', err);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}