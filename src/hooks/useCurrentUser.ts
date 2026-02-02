/**
 * 현재 로그인한 사용자 정보를 관리하는 훅
 * 
 * 설계 의도:
 * - Supabase 세션에서 사용자 정보 조회
 * - 로그인/비로그인 상태 관리
 * - 여러 컴포넌트에서 재사용 가능
 */

import { useState, useEffect } from 'react';

export interface CurrentUser {
  id: string;
  nickname: string;
  role: string; // 'USER' | 'ADMIN'
}

interface UseCurrentUserReturn {
  currentUser: CurrentUser | null;
  isLoadingUser: boolean;
}

/**
 * 현재 로그인한 사용자 정보를 가져옵니다.
 * 
 * @returns 현재 사용자 정보와 로딩 상태
 * 
 * @example
 * const { currentUser, isLoadingUser } = useCurrentUser();
 * if (currentUser) {
 *   console.log(`안녕하세요, ${currentUser.nickname}님`);
 * }
 */
export function useCurrentUser(): UseCurrentUserReturn {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('user_id, nickname, role')
            .eq('user_id', session.user.id)
            .is('deleted_at', null)
            .single();
          
          if (userData) {
            setCurrentUser({ 
              id: userData.user_id, 
              nickname: userData.nickname,
              role: userData.role || 'USER',
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch current user:', err);
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchCurrentUser();
  }, []);

  return { currentUser, isLoadingUser };
}
