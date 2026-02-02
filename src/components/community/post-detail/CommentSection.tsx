/**
 * 댓글 섹션 컴포넌트
 * 
 * 설계 의도:
 * - 댓글 작성 폼
 * - 댓글 목록 (로딩/빈 상태 포함)
 * - CommentItem 컴포넌트 활용
 * - 수정/삭제 기능 지원
 */

"use client";

import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle } from "lucide-react";
import { CommentItem } from "./CommentItem";
import type { CommentWithReplies } from "@/hooks";

interface CommentSectionProps {
  commentCount: number;
  comments: CommentWithReplies[];
  currentUserId: string | null;
  isAdmin: boolean;
  isLoadingComments: boolean;
  isSubmittingComment: boolean;
  newComment: string;
  setNewComment: (value: string) => void;
  replyTo: number | null;
  setReplyTo: (id: number | null) => void;
  replyContent: string;
  setReplyContent: (value: string) => void;
  editingCommentId: number | null;
  setEditingCommentId: (id: number | null) => void;
  editContent: string;
  setEditContent: (value: string) => void;
  onSubmitComment: (e: React.FormEvent) => Promise<void>;
  onSubmitReply: (parentId: number) => Promise<void>;
  onUpdateComment: (commentId: number) => Promise<boolean>;
  onDeleteComment: (commentId: number) => Promise<boolean>;
}

/**
 * 댓글 전체 섹션을 렌더링합니다.
 */
export function CommentSection({
  commentCount,
  comments,
  currentUserId,
  isAdmin,
  isLoadingComments,
  isSubmittingComment,
  newComment,
  setNewComment,
  replyTo,
  setReplyTo,
  replyContent,
  setReplyContent,
  editingCommentId,
  setEditingCommentId,
  editContent,
  setEditContent,
  onSubmitComment,
  onSubmitReply,
  onUpdateComment,
  onDeleteComment,
}: CommentSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        댓글 {commentCount}개
      </h2>

      {/* 댓글 작성 폼 */}
      <form onSubmit={onSubmitComment} className="mb-6 space-y-3">
        <div className="text-xs text-muted-foreground mb-2">
          💡 대댓글은 댓글 내용을 클릭하면 대댓글 창이 열립니다.
        </div>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="댓글을 입력하세요..."
          className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm resize-y"
          required
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isSubmittingComment}>
            {isSubmittingComment ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                작성 중...
              </>
            ) : (
              '댓글 작성'
            )}
          </Button>
        </div>
      </form>

      {/* 댓글 목록 */}
      {isLoadingComments ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            첫 댓글을 작성해보세요!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.comment_id}
              comment={comment}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              editingCommentId={editingCommentId}
              setEditingCommentId={setEditingCommentId}
              editContent={editContent}
              setEditContent={setEditContent}
              onSubmitReply={onSubmitReply}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
              isSubmitting={isSubmittingComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
