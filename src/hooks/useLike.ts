/**
 * 좋아요 기능을 관리하는 훅
 * 
 * 설계 의도:
 * - 로그인/비로그인 사용자 모두 지원
 * - 로그인: DB 저장, 비로그인: LocalStorage 저장
 * - 낙관적 업데이트로 즉각적인 피드백
 */

import { useState, useEffect, useCallback } from 'react';
import type { CurrentUser } from './useCurrentUser';

interface UseLikeReturn {
  isLiked: boolean;
  isLiking: boolean;
  toggleLike: () => Promise<{ liked: boolean; newCount: number } | null>;
}

/**
 * 게시글 좋아요 기능을 관리합니다.
 * 
 * @param postId - 게시글 ID
 * @param currentUser - 현재 로그인한 사용자 (없으면 비로그인)
 * @param isLoadingUser - 사용자 정보 로딩 중 여부
 * @returns 좋아요 상태 및 토글 함수
 * 
 * @example
 * const { isLiked, isLiking, toggleLike } = useLike('123', currentUser, false);
 * const result = await toggleLike();
 * if (result) {
 *   console.log(`좋아요 ${result.liked ? '추가' : '취소'}, 총 ${result.newCount}개`);
 * }
 */
export function useLike(
  postId: string,
  currentUser: CurrentUser | null,
  isLoadingUser: boolean
): UseLikeReturn {
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  // 좋아요 상태 조회
  useEffect(() => {
    const fetchLikeStatus = async () => {
      try {
        if (currentUser) {
          // 로그인 사용자: DB에서 조회
          const response = await fetch(`/api/community/posts/${postId}/like?user_id=${currentUser.id}`);
          if (response.ok) {
            const data = await response.json();
            setIsLiked(data.liked);
          }
        } else {
          // 비로그인 사용자: LocalStorage에서 확인
          const likedPosts = JSON.parse(localStorage.getItem('liked_posts') || '[]');
          setIsLiked(likedPosts.includes(Number(postId)));
        }
      } catch (err) {
        console.error('Failed to fetch like status:', err);
      }
    };

    if (postId && !isLoadingUser) {
      fetchLikeStatus();
    }
  }, [postId, currentUser, isLoadingUser]);

  // 좋아요 토글
  const toggleLike = useCallback(async (): Promise<{ liked: boolean; newCount: number } | null> => {
    if (isLiking) return null;

    setIsLiking(true);
    try {
      const postIdNum = Number(postId);
      
      if (currentUser) {
        // 로그인 사용자: DB에 저장
        const response = await fetch(`/api/community/posts/${postId}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUser.id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setIsLiked(data.liked);
          return { liked: data.liked, newCount: data.like_count || 0 };
        }
      } else {
        // 비로그인 사용자: LocalStorage + DB에 저장
        const likedPosts: number[] = JSON.parse(localStorage.getItem('liked_posts') || '[]');
        const alreadyLiked = likedPosts.includes(postIdNum);
        
        const response = await fetch(`/api/community/posts/${postId}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: null,
            action: alreadyLiked ? 'unlike' : 'like',
          }),
        });

        if (response.ok) {
          const newLiked = !alreadyLiked;
          
          if (alreadyLiked) {
            // 좋아요 취소
            const newLikedPosts = likedPosts.filter(id => id !== postIdNum);
            localStorage.setItem('liked_posts', JSON.stringify(newLikedPosts));
          } else {
            // 좋아요 추가
            likedPosts.push(postIdNum);
            localStorage.setItem('liked_posts', JSON.stringify(likedPosts));
          }
          
          setIsLiked(newLiked);
          return { liked: newLiked, newCount: 0 }; // 비로그인은 count 모름
        }
      }
      
      return null;
    } catch (err) {
      console.error('Failed to toggle like:', err);
      return null;
    } finally {
      setIsLiking(false);
    }
  }, [postId, currentUser, isLiking]);

  return { isLiked, isLiking, toggleLike };
}
