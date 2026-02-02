/**
 * 개별 댓글 컴포넌트
 * 
 * 설계 의도:
 * - 단일 댓글 렌더링 (대댓글 포함)
 * - 대댓글 펼침/접힘 상태 관리
 * - 답글 작성 폼 표시
 * - 수정/삭제 기능 (본인 또는 관리자)
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils/date";
import { renderContentWithMentions } from "@/lib/utils/text";
import type { CommentWithReplies } from "@/hooks";

interface CommentItemProps {
  comment: CommentWithReplies;
  currentUserId: string | null;
  isAdmin: boolean;
  replyTo: number | null;
  setReplyTo: (id: number | null) => void;
  replyContent: string;
  setReplyContent: (value: string) => void;
  editingCommentId: number | null;
  setEditingCommentId: (id: number | null) => void;
  editContent: string;
  setEditContent: (value: string) => void;
  onSubmitReply: (parentId: number) => Promise<void>;
  onUpdateComment: (commentId: number) => Promise<boolean>;
  onDeleteComment: (commentId: number) => Promise<boolean>;
  isSubmitting: boolean;
}

/**
 * 개별 댓글을 렌더링합니다. 대댓글도 포함합니다.
 */
export function CommentItem({
  comment,
  currentUserId,
  isAdmin,
  replyTo,
  setReplyTo,
  replyContent,
  setReplyContent,
  editingCommentId,
  setEditingCommentId,
  editContent,
  setEditContent,
  onSubmitReply,
  onUpdateComment,
  onDeleteComment,
  isSubmitting,
}: CommentItemProps) {
  // 스레드 펼침/접힘 상태
  const [isExpanded, setIsExpanded] = useState(false);
  // 더보기 메뉴 상태
  const [showMenu, setShowMenu] = useState<number | null>(null);

  const hasReplies = comment.replies && comment.replies.length > 0;
  const hasManyReplies = comment.replies && comment.replies.length >= 5;

  // 대댓글 표시 여부
  const shouldShowReplies = hasReplies && (!hasManyReplies || isExpanded);

  // 수정/삭제 권한 체크
  const canEditComment = (userId: string) => {
    return currentUserId === userId || isAdmin;
  };

  // 수정 모드 시작
  const startEditing = (commentId: number, content: string) => {
    setEditingCommentId(commentId);
    setEditContent(content);
    setShowMenu(null);
  };

  // 수정 취소
  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  // 댓글/대댓글 렌더링 함수
  const renderCommentContent = (
    item: CommentWithReplies,
    isReply: boolean = false
  ) => {
    const isEditing = editingCommentId === item.comment_id;
    const canEdit = canEditComment(item.user_id);

    return (
      <div 
        key={item.comment_id} 
        className={`rounded-lg border border-border ${isReply ? 'bg-background p-3' : 'bg-muted/30 p-4'}`}
      >
        {/* 헤더: 작성자, 날짜, 더보기 메뉴 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {item.author_name}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(item.created_at)}
            </span>
            {item.created_at !== item.updated_at && (
              <span className="text-xs text-muted-foreground">(수정됨)</span>
            )}
          </div>
          
          {/* 수정/삭제 버튼 (본인 또는 관리자만) */}
          {canEdit && !isEditing && (
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowMenu(showMenu === item.comment_id ? null : item.comment_id)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              
              {showMenu === item.comment_id && (
                <div className="absolute right-0 top-8 z-10 min-w-[100px] rounded-md border border-border bg-background shadow-md">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => startEditing(item.comment_id, item.content)}
                  >
                    <Edit className="h-3 w-3" />
                    수정
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                    onClick={() => {
                      setShowMenu(null);
                      onDeleteComment(item.comment_id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    삭제
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 내용 또는 수정 폼 */}
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[60px] rounded-md border border-border bg-background px-2 py-1 text-sm resize-y"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelEditing}
                disabled={isSubmitting}
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onUpdateComment(item.comment_id)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    수정 중...
                  </>
                ) : (
                  '수정 완료'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div 
            className="mt-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => !isReply && setReplyTo(item.comment_id)}
          >
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {renderContentWithMentions(item.content)}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* 댓글 본문 */}
      {renderCommentContent(comment, false)}

      {/* 대댓글 펼침/접힘 토글 (5개 이상일 때만) */}
      {hasManyReplies && (
        <div className="ml-8 mt-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {isExpanded 
              ? `답글 ${comment.replies!.length}개 접기 ▲`
              : `답글 ${comment.replies!.length}개 보기 ▼`
            }
          </button>
        </div>
      )}

      {/* 대댓글 목록 */}
      {shouldShowReplies && (
        <div className="ml-8 mt-2 space-y-2">
          {comment.replies!.map((reply) => renderCommentContent(reply, true))}
        </div>
      )}

      {/* 대댓글 작성 폼 */}
      {replyTo === comment.comment_id && (
        <div className="ml-8 rounded-lg border border-border bg-background p-3">
          <div className="space-y-2">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="답글을 입력하세요..."
              className="w-full min-h-[60px] rounded-md border border-border bg-muted/50 px-2 py-1 text-sm resize-y"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReplyTo(null);
                  setReplyContent('');
                }}
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onSubmitReply(comment.comment_id)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    작성 중...
                  </>
                ) : (
                  '답글 작성'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
