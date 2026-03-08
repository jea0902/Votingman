"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NotificationRow } from "@/lib/supabase/db-types";

/**
 * 알림 종 아이콘 + 드롭다운 컴포넌트
 * 
 * 기능:
 * - 읽지 않은 알림 수 배지 표시
 * - 알림 드롭다운 목록
 * - 클릭시 해당 페이지로 이동
 * - 실시간 알림 폴링 (30초마다)
 */

interface NotificationBellProps {
  userId?: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  console.log('NotificationBell 렌더링:', { userId });

  // 로그인하지 않은 사용자는 알림 표시 안함
  if (!userId) {
    console.log('NotificationBell: userId 없음 - null 반환');
    return null;
  }

  // 알림 목록 조회
  const fetchNotifications = async (loadMore = false) => {
    try {
      // 추가 안전장치: userId 없으면 조기 리턴
      if (!userId) {
        console.warn('NotificationBell: userId가 없어서 API 호출을 건너뜁니다.');
        return;
      }
      
      console.log('NotificationBell: API 호출 시작', { userId, loadMore });
      
      const limit = loadMore ? 20 : 5;
      const response = await fetch(`/api/notifications?limit=${limit}`, {
        credentials: 'include', // 쿠키 포함
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('NotificationBell: API 응답 상태', { 
        status: response.status, 
        ok: response.ok
      });

      // 401 에러 (인증 실패)인 경우 조용히 처리
      if (response.status === 401) {
        console.log('NotificationBell: 401 인증 에러 - 조용히 처리');
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      
      const result = await response.json();
      console.log('NotificationBell: API 응답 데이터', result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'API 호출 실패');
      }

      const notifications = result.data.notifications as NotificationRow[];
      setNotifications(notifications);
      setUnreadCount(result.data.unread_count);
    } catch (error) {
      // 네트워크 오류(서버 중단, 오프라인 등) → 기존 데이터 유지, 콘솔만 조용히
      const isNetworkError =
        error instanceof TypeError &&
        (error.message === "Failed to fetch" || error.message === "Load failed");
      if (isNetworkError) {
        return;
      }
      // 401 관련 에러는 조용히 처리
      if (error instanceof Error && error.message.includes('인증이 필요')) {
        setNotifications([]);
        setUnreadCount(0);
      } else {
        console.error('NotificationBell: 예상치 못한 에러:', error);
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 더보기 처리
  const handleShowMore = async () => {
    if (!showMore) {
      setShowMore(true);
      await fetchNotifications(true);
    } else {
      setShowMore(false);
      await fetchNotifications(false);
    }
  };

  // 알림 읽음 처리
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 쿠키 포함
        body: JSON.stringify({ notification_id: notificationId })
      });

      // 401 에러인 경우 조용히 처리
      if (response.status === 401) {
        console.log('NotificationBell: markAsRead 401 에러 - 조용히 처리');
        return;
      }

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '읽음 처리 실패');
      }

      // 로컬 상태 업데이트
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError &&
        (error.message === "Failed to fetch" || error.message === "Load failed");
      if (isNetworkError) return;
      if (error instanceof Error && error.message.includes('인증이 필요')) {
        // 조용히 처리
      } else {
        console.error('NotificationBell: markAsRead 예상치 못한 에러:', error);
      }
    }
  };

  // 알림 클릭 처리 (페이지 이동 + 읽음 처리)
  const handleNotificationClick = async (notification: NotificationRow) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    const redirectUrl = notification.metadata.redirect_url || '/profile/stats';
    router.push(redirectUrl);
    setIsOpen(false);
  };

  // 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Supabase Auth 상태 변화 감지
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    
    // 현재 세션 확인 후 API 호출
    const initializeNotifications = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id === userId) {
          console.log('NotificationBell: 세션 확인됨, API 호출 시작');
          await fetchNotifications();
        } else {
          console.warn('NotificationBell: 세션과 userId 불일치', { 
            sessionUserId: session?.user?.id, 
            propsUserId: userId 
          });
        }
      } catch (error) {
        console.error('NotificationBell: 세션 확인 실패:', error);
      }
    };

    initializeNotifications();

    // Auth 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('NotificationBell: Auth 상태 변화:', event, session?.user?.id);
        if (event === 'SIGNED_IN' && session?.user?.id === userId) {
          await fetchNotifications();
        } else if (event === 'SIGNED_OUT') {
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    );
    
    // 30초마다 새 알림 체크 (세션이 있을 때만)
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id === userId) {
        await fetchNotifications();
      }
    }, 30000);
    
    return () => {
      subscription?.unsubscribe();
      clearInterval(interval);
    };
  }, [userId]);

  // 상대시간 포맷
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return '방금';
    if (diffMins < 60) return `${diffMins}분전`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간전`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}일전`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 종 아이콘 + 배지 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="알림"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center min-w-[20px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 알림 드롭다운 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">알림</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {unreadCount}개의 새로운 알림
              </p>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                로딩 중...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                새로운 알림이 없습니다
              </div>
            ) : (
              (showMore ? notifications : notifications.slice(0, 5)).map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left p-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* 투표 제목 */}
                      <h4 className={`text-sm font-medium truncate ${
                        !notification.is_read ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {notification.title}
                      </h4>
                      
                      {/* 정산 내용 */}
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.content}
                      </p>
                      
                      {/* 시간 */}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatRelativeTime(notification.created_at)}
                      </p>
                    </div>

                    {/* 읽지 않음 표시 */}
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 더보기 버튼 */}
          {notifications.length >= 5 && (
            <div className="p-3 border-t border-border">
              <button
                onClick={handleShowMore}
                className="w-full text-sm text-primary hover:underline text-center"
              >
                {showMore ? '접기 ↑' : '더보기 ↓'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}