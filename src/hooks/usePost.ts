/**
 * 게시글 조회 및 관리를 위한 훅
 * 
 * 설계 의도:
 * - 게시글 데이터 조회/캐싱
 * - 로딩/에러 상태 관리
 * - 게시글 새로고침 기능
 */

import { useState, useEffect, useCallback } from 'react';
import type { PostDetailResponse } from '@/lib/supabase/db-types';

interface UsePostReturn {
  post: PostDetailResponse | null;
  isLoading: boolean;
  error: string;
  refreshPost: () => Promise<void>;
  updatePost: (updates: Partial<PostDetailResponse>) => void;
}

/**
 * 게시글 상세 정보를 조회하고 관리합니다.
 * 
 * @param postId - 조회할 게시글 ID
 * @returns 게시글 데이터, 로딩/에러 상태, 관리 함수들
 * 
 * @example
 * const { post, isLoading, error, refreshPost } = usePost('123');
 */
export function usePost(postId: string): UsePostReturn {
  const [post, setPost] = useState<PostDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 게시글 조회 함수
  const fetchPost = useCallback(async () => {
    if (!postId) return;
    
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/community/posts/${postId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('게시글을 찾을 수 없습니다.');
        }
        throw new Error('게시글을 불러오는데 실패했습니다.');
      }

      const data: PostDetailResponse = await response.json();
      setPost(data);
    } catch (err) {
      console.error('Failed to fetch post:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  // 초기 로딩
  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // 게시글 새로고침
  const refreshPost = useCallback(async () => {
    try {
      const response = await fetch(`/api/community/posts/${postId}`);
      if (response.ok) {
        const data: PostDetailResponse = await response.json();
        setPost(data);
      }
    } catch (err) {
      console.error('Failed to refresh post:', err);
    }
  }, [postId]);

  // 게시글 부분 업데이트 (낙관적 업데이트용)
  const updatePost = useCallback((updates: Partial<PostDetailResponse>) => {
    setPost(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return { post, isLoading, error, refreshPost, updatePost };
}
