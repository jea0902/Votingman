/**
 * 첨부파일 섹션 컴포넌트
 * 
 * 설계 의도:
 * - 첨부 이미지 다운로드 링크 표시
 * - 파일명 추출 및 표시
 */

"use client";

import type { PostImage } from "@/hooks";

interface AttachmentSectionProps {
  images: PostImage[];
  isLoading: boolean;
}

/**
 * 첨부파일 다운로드 섹션을 렌더링합니다.
 */
export function AttachmentSection({ images, isLoading }: AttachmentSectionProps) {
  if (isLoading || images.length === 0) {
    return null;
  }

  return (
    <div className="my-6 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        📎 첨부파일 {images.length}개
      </h3>
      <div className="space-y-2">
        {images.map((image) => {
          const urlParts = image.image_url.split('/');
          const fullFileName = urlParts[urlParts.length - 1];
          
          return (
            <a
              key={image.image_id}
              href={image.image_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-primary hover:underline"
            >
              {fullFileName}
            </a>
          );
        })}
      </div>
    </div>
  );
}
