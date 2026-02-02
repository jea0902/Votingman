/**
 * 게시글 이미지 조회를 위한 훅
 * 
 * 설계 의도:
 * - 게시글 첨부 이미지 목록 조회
 * - 로딩 상태 관리
 */

import { useState, useEffect, useRef } from 'react';

export interface PostImage {
  image_id: number;
  image_url: string;
  sort_order: number;
}

interface UsePostImagesReturn {
  images: PostImage[];
  isLoadingImages: boolean;
}

/**
 * 게시글의 첨부 이미지 목록을 조회합니다.
 * 
 * @param postId - 게시글 ID
 * @param enabled - 조회 활성화 여부 (게시글 로딩 완료 후 true)
 * @returns 이미지 목록과 로딩 상태
 * 
 * @example
 * const { images, isLoadingImages } = usePostImages('123', !!post);
 */
export function usePostImages(postId: string, enabled: boolean): UsePostImagesReturn {
  const [images, setImages] = useState<PostImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  
  // 초기 로딩 완료 여부 (중복 호출 방지)
  const hasFetched = useRef(false);

  useEffect(() => {
    const fetchImages = async () => {
      // 이미 로딩했으면 다시 호출하지 않음
      if (!enabled || hasFetched.current) return;
      
      hasFetched.current = true;
      setIsLoadingImages(true);
      try {
        const response = await fetch(`/api/community/posts/${postId}/images`);
        if (response.ok) {
          const data = await response.json();
          setImages(data.images || []);
        }
      } catch (err) {
        console.error('Failed to fetch images:', err);
      } finally {
        setIsLoadingImages(false);
      }
    };

    if (postId && enabled) {
      fetchImages();
    }
  }, [postId, enabled]);

  return { images, isLoadingImages };
}
