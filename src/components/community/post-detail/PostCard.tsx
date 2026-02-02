/**
 * 게시글 카드 컴포넌트
 * 
 * 설계 의도:
 * - 게시글 헤더 (카테고리, 제목, 메타 정보)
 * - 게시글 본문 + 이미지
 * - 액션 버튼 (목록, 수정, 삭제)
 */

"use client";

import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Eye, 
  ThumbsUp, 
  MessageCircle,
  Edit,
  Trash2,
  Pin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/utils/date";
import type { PostDetailResponse } from "@/lib/supabase/db-types";
import type { PostImage } from "@/hooks";

interface PostCardProps {
  post: PostDetailResponse;
  images: PostImage[];
  isLoadingImages: boolean;
  canEdit: boolean; // 수정/삭제 권한 (본인 또는 관리자)
  onGoBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * 게시글 카드를 렌더링합니다 (헤더 + 본문 + 이미지 + 액션 버튼).
 */
export function PostCard({
  post,
  images,
  isLoadingImages,
  canEdit,
  onGoBack,
  onEdit,
  onDelete,
}: PostCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      {/* 헤더 */}
      <div className="border-b border-border p-6">
        {/* 카테고리 & 고정 뱃지 */}
        <div className="flex items-center gap-2 mb-3">
          {post.is_pinned && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
              <Pin className="h-3 w-3" />
              공지
            </span>
          )}
          {post.category && (
            <span className={cn(
              "text-xs px-2 py-1 rounded-full",
              post.category === 'free' 
                ? "bg-primary/10 text-primary"
                : "bg-accent/10 text-accent"
            )}>
              {post.category === 'free' ? '자유' : '건의'}
            </span>
          )}
          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
            {post.board_type === 'free' ? '자유게시판' : '관점 게시판'}
          </span>
        </div>

        {/* 제목 */}
        <h1 className="text-2xl font-bold text-foreground mb-4">
          {post.title}
        </h1>

        {/* 메타 정보 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{post.author_name}</span>
            <span>{formatRelativeDate(post.created_at)}</span>
            {post.created_at !== post.updated_at && (
              <span className="text-xs">(수정됨)</span>
            )}
          </div>
          
          {/* 통계 */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {post.view_count}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-4 w-4" />
              {post.like_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {post.comment_count}
            </span>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="p-6">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div className="whitespace-pre-wrap break-words text-foreground">
            {post.content}
          </div>
        </div>

        {/* 이미지 */}
        {!isLoadingImages && images.length > 0 && (
          <div className="mt-6 space-y-4 flex flex-col items-center">
            {images.map((image) => (
              <div key={image.image_id} className="inline-block rounded-lg overflow-hidden border border-border">
                <img
                  src={image.image_url}
                  alt={`첨부 이미지 ${image.sort_order + 1}`}
                  className="h-auto max-h-[600px] max-w-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="border-t border-border p-4 flex justify-between">
        <Button variant="outline" onClick={onGoBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록
        </Button>

        {/* 본인 게시글 또는 관리자만 수정/삭제 버튼 표시 */}
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              수정
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
