"use client";

/**
 * 게시글 수정 다이얼로그
 * 
 * 설계 의도:
 * - 기존 게시글 내용을 불러와 수정 가능
 * - 제목, 내용, 카테고리(자유게시판만) 수정 가능
 * - 수정 완료 시 상세 페이지 새로고침
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import type { PostDetailResponse } from "@/lib/supabase/db-types";

type Category = 'free' | 'suggestion';

type EditPostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: PostDetailResponse;
  onSuccess?: () => void;
};

export function EditPostDialog({ 
  open, 
  onOpenChange, 
  post,
  onSuccess 
}: EditPostDialogProps) {
  const [category, setCategory] = useState<Category>(post.category || 'free');
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // post가 변경되면 폼 초기화
  useEffect(() => {
    setTitle(post.title);
    setContent(post.content);
    setCategory(post.category || 'free');
  }, [post]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // 입력 검증
      if (!title.trim()) {
        setError('제목을 입력해주세요.');
        setIsSubmitting(false);
        return;
      }

      if (!content.trim()) {
        setError('내용을 입력해주세요.');
        setIsSubmitting(false);
        return;
      }

      // API 호출
      const response = await fetch(`/api/community/posts/${post.post_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category: post.board_type === 'free' ? category : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '게시글 수정에 실패했습니다.');
      }

      // 성공: 모달 닫기
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (err) {
      console.error('Failed to update post:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      // 원래 값으로 리셋
      setTitle(post.title);
      setContent(post.content);
      setCategory(post.category || 'free');
      setError('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>게시글 수정</DialogTitle>
          <DialogDescription>
            게시글의 제목과 내용을 수정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* 자유게시판: 카테고리 선택 */}
          {post.board_type === 'free' && (
            <div className="space-y-2">
              <Label>
                카테고리 <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={category}
                onValueChange={(value) => setCategory(value as Category)}
                disabled={isSubmitting}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="free" id="edit-cat-free" />
                  <Label htmlFor="edit-cat-free" className="cursor-pointer font-normal">
                    💬 자유 - 일상 투자 이야기, 질문 등
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="suggestion" id="edit-cat-suggestion" />
                  <Label htmlFor="edit-cat-suggestion" className="cursor-pointer font-normal">
                    💡 건의 - 서비스 개선 제안
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* 제목 */}
          <div className="space-y-2">
            <Label htmlFor="edit-post-title">
              제목 <span className="text-destructive">*</span>
            </Label>
            <input
              id="edit-post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="제목을 입력하세요"
              maxLength={300}
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/300자
            </p>
          </div>

          {/* 내용 */}
          <div className="space-y-2">
            <Label htmlFor="edit-post-content">
              내용 <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="edit-post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              placeholder="내용을 입력하세요"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  수정 중...
                </>
              ) : (
                '수정 완료'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
