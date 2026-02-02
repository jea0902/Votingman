"use client";

/**
 * 게시글 상세 페이지
 * 
 * 설계 의도:
 * - 게시글 전체 내용 표시
 * - 조회수 자동 증가 (API에서 처리)
 * - 수정/삭제 버튼
 * - 좋아요, 댓글 기능
 * 
 * 아키텍처:
 * - 커스텀 훅으로 상태 관리 분리
 * - 하위 컴포넌트로 UI 분리
 * - 페이지는 조합만 담당
 */

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { EditPostDialog } from "@/components/community/EditPostDialog";

// 커스텀 훅
import { useCurrentUser, usePost, useLike, usePostImages, useComments } from "@/hooks";

// 하위 컴포넌트
import {
  PostCard,
  LikeButton,
  AttachmentSection,
  CommentSection,
  DeleteConfirmDialog,
} from "@/components/community/post-detail";

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  // 커스텀 훅 사용
  const { currentUser, isLoadingUser } = useCurrentUser();
  const { post, isLoading, error, refreshPost, updatePost } = usePost(postId);
  const { isLiked, isLiking, toggleLike } = useLike(postId, currentUser, isLoadingUser);
  const { images, isLoadingImages } = usePostImages(postId, !!post);
  const {
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
  } = useComments(postId, currentUser, !!post);

  // 로컬 상태 (UI 전용)
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // 이벤트 핸들러
  const handleGoBack = () => router.push('/community');
  
  const handleEdit = () => setIsEditDialogOpen(true);
  
  const handleEditSuccess = () => refreshPost();

  const handleLikeToggle = async () => {
    const result = await toggleLike();
    if (result && post) {
      updatePost({
        like_count: result.liked ? post.like_count + 1 : post.like_count - 1,
      });
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    const success = await submitComment(e);
    if (success && post) {
      updatePost({ comment_count: post.comment_count + 1 });
    }
  };

  const handleReplySubmit = async (parentId: number) => {
    const success = await submitReply(parentId);
    if (success && post) {
      updatePost({ comment_count: post.comment_count + 1 });
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    const success = await deleteComment(commentId);
    if (success && post) {
      updatePost({ comment_count: Math.max(0, post.comment_count - 1) });
    }
    return success;
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/community/posts/${postId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '게시글 삭제에 실패했습니다.');
      }

      router.push('/community');
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">게시글을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error || !post) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-destructive mb-4">{error || '게시글을 찾을 수 없습니다.'}</p>
          <Button variant="outline" onClick={handleGoBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  // 수정/삭제 권한 체크: 본인 게시글 또는 관리자(ADMIN)
  const isOwner = currentUser?.id === post.user_id;
  const isAdmin = currentUser?.role === 'ADMIN';
  const canEdit = isOwner || isAdmin;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* 상단 네비게이션 */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={handleGoBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          목록으로
        </Button>
      </div>

      {/* 게시글 카드 */}
      <PostCard
        post={post}
        images={images}
        isLoadingImages={isLoadingImages}
        canEdit={canEdit}
        onGoBack={handleGoBack}
        onEdit={handleEdit}
        onDelete={() => setIsDeleteDialogOpen(true)}
      />

      {/* 좋아요 버튼 */}
      <LikeButton
        isLiked={isLiked}
        isLiking={isLiking}
        likeCount={post.like_count}
        onToggle={handleLikeToggle}
      />

      {/* 첨부파일 섹션 */}
      <AttachmentSection images={images} isLoading={isLoadingImages} />

      {/* 댓글 섹션 */}
      <CommentSection
        commentCount={post.comment_count}
        comments={comments}
        currentUserId={currentUser?.id || null}
        isAdmin={isAdmin}
        isLoadingComments={isLoadingComments}
        isSubmittingComment={isSubmittingComment}
        newComment={newComment}
        setNewComment={setNewComment}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        replyContent={replyContent}
        setReplyContent={setReplyContent}
        editingCommentId={editingCommentId}
        setEditingCommentId={setEditingCommentId}
        editContent={editContent}
        setEditContent={setEditContent}
        onSubmitComment={handleCommentSubmit}
        onSubmitReply={handleReplySubmit}
        onUpdateComment={updateComment}
        onDeleteComment={handleDeleteComment}
      />

      {/* 수정 다이얼로그 */}
      <EditPostDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        post={post}
        onSuccess={handleEditSuccess}
      />

      {/* 삭제 확인 다이얼로그 */}
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
