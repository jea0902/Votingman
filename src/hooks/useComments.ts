/**
 * 댓글 기능을 관리하는 훅
 * 
 * 설계 의도:
 * - 댓글 목록 조회
 * - 댓글/대댓글 작성
 * - 로그인/비로그인 사용자 모두 지원
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAnonymousNickname, saveMyAnonymousComment } from '@/lib/utils/anonymous';
import type { CurrentUser } from './useCurrentUser';

export interface CommentWithReplies {
  comment_id: number;
  post_id: number;
  user_id: string;
  content: string;
  author_name: string;
  parent_comment_id: number | null;
  depth: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  replies?: CommentWithReplies[];
}

interface UseCommentsReturn {
  comments: CommentWithReplies[];
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
  submitComment: (e: React.FormEvent) => Promise<boolean>;
  submitReply: (parentId: number) => Promise<boolean>;
  updateComment: (commentId: number) => Promise<boolean>;
  deleteComment: (commentId: number) => Promise<boolean>;
  refreshComments: () => Promise<void>;
}

/**
 * 게시글의 댓글 기능을 관리합니다.
 * 
 * @param postId - 게시글 ID
 * @param currentUser - 현재 로그인한 사용자
 * @param enabled - 활성화 여부 (게시글 로딩 완료 후)
 * @returns 댓글 데이터 및 관리 함수들
 */
export function useComments(
  postId: string,
  currentUser: CurrentUser | null,
  enabled: boolean
): UseCommentsReturn {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  
  // 수정 상태
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // 초기 로딩 완료 여부 (중복 호출 방지)
  const hasFetched = useRef(false);

  // 댓글 목록 조회
  const refreshComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/community/posts/${postId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  }, [postId]);

  // 초기 로딩 (한 번만 실행)
  useEffect(() => {
    const fetchComments = async () => {
      // 이미 로딩했으면 다시 호출하지 않음
      if (!enabled || hasFetched.current) return;
      
      hasFetched.current = true;
      setIsLoadingComments(true);
      try {
        await refreshComments();
      } finally {
        setIsLoadingComments(false);
      }
    };

    if (postId && enabled) {
      fetchComments();
    }
  }, [postId, enabled, refreshComments]);

  // 댓글 작성
  const submitComment = useCallback(async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault();
    if (!newComment.trim()) return false;

    setIsSubmittingComment(true);
    try {
      const authorName = currentUser ? currentUser.nickname : getAnonymousNickname();
      
      const response = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment.trim(),
          author_name: authorName,
          user_id: currentUser?.id || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewComment('');
        
        // 비회원인 경우 내 댓글 ID 저장
        if (!currentUser && data.comment) {
          saveMyAnonymousComment(data.comment.comment_id);
        }
        
        await refreshComments();
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '댓글 작성에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
      alert(err instanceof Error ? err.message : '댓글 작성에 실패했습니다.');
      return false;
    } finally {
      setIsSubmittingComment(false);
    }
  }, [postId, newComment, currentUser, refreshComments]);

  // 대댓글 작성
  const submitReply = useCallback(async (parentId: number): Promise<boolean> => {
    if (!replyContent.trim()) return false;

    setIsSubmittingComment(true);
    try {
      const authorName = currentUser ? currentUser.nickname : getAnonymousNickname();
      
      const response = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent.trim(),
          author_name: authorName,
          parent_comment_id: parentId,
          user_id: currentUser?.id || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReplyContent('');
        setReplyTo(null);
        
        // 비회원인 경우 내 댓글 ID 저장
        if (!currentUser && data.comment) {
          saveMyAnonymousComment(data.comment.comment_id);
        }
        
        await refreshComments();
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '대댓글 작성에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to submit reply:', err);
      alert(err instanceof Error ? err.message : '대댓글 작성에 실패했습니다.');
      return false;
    } finally {
      setIsSubmittingComment(false);
    }
  }, [postId, replyContent, currentUser, refreshComments]);

  // 댓글 수정
  const updateComment = useCallback(async (commentId: number): Promise<boolean> => {
    if (!editContent.trim()) return false;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`/api/community/posts/${postId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent.trim(),
        }),
      });

      if (response.ok) {
        setEditContent('');
        setEditingCommentId(null);
        await refreshComments();
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '댓글 수정에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to update comment:', err);
      alert(err instanceof Error ? err.message : '댓글 수정에 실패했습니다.');
      return false;
    } finally {
      setIsSubmittingComment(false);
    }
  }, [postId, editContent, refreshComments]);

  // 댓글 삭제
  const deleteComment = useCallback(async (commentId: number): Promise<boolean> => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return false;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`/api/community/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await refreshComments();
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '댓글 삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert(err instanceof Error ? err.message : '댓글 삭제에 실패했습니다.');
      return false;
    } finally {
      setIsSubmittingComment(false);
    }
  }, [postId, refreshComments]);

  return {
    comments,
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
    submitComment,
    submitReply,
    updateComment,
    deleteComment,
    refreshComments,
  };
}
