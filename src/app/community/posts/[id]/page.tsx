"use client";

/**
 * 게시글 상세 페이지
 * 
 * 설계 의도:
 * - 게시글 전체 내용 표시
 * - 조회수 자동 증가 (API에서 처리)
 * - 수정/삭제 버튼 (임시: 모두에게 표시, 인증 후 본인만)
 * - 목록으로 돌아가기 네비게이션
 * 
 * 확장성:
 * - 댓글 섹션 추가 가능
 * - 좋아요 기능 추가 가능
 * - 공유 기능 추가 가능
 */

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Eye, 
  ThumbsUp, 
  MessageCircle,
  Edit,
  Trash2,
  Loader2,
  Pin
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostDetailResponse } from "@/lib/supabase/db-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditPostDialog } from "@/components/community/EditPostDialog";

type CommentWithReplies = {
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
};

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const [post, setPost] = useState<PostDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // 좋아요 상태
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  // 댓글 상태
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // 스레드 펼침/접힘 상태 (comment_id -> boolean)
  const [expandedThreads, setExpandedThreads] = useState<Record<number, boolean>>({});

  // 이미지 목록
  const [images, setImages] = useState<{image_id: number; image_url: string; sort_order: number}[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  // 로그인 사용자 정보
  const [currentUser, setCurrentUser] = useState<{ id: string; nickname: string } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // 로그인 사용자 정보 조회
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('user_id, nickname')
            .eq('user_id', session.user.id)
            .is('deleted_at', null)
            .single();
          
          if (userData) {
            setCurrentUser({ id: userData.user_id, nickname: userData.nickname });
          }
        }
      } catch (err) {
        console.error('Failed to fetch current user:', err);
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchCurrentUser();
  }, []);

  // 게시글 조회
  useEffect(() => {
    const fetchPost = async () => {
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
    };

    if (postId) {
      fetchPost();
    }
  }, [postId]);

  // 좋아요 상태 조회 (LocalStorage + DB 하이브리드)
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

  // 댓글 목록 조회
  useEffect(() => {
    const fetchComments = async () => {
      setIsLoadingComments(true);
      try {
        const response = await fetch(`/api/community/posts/${postId}/comments`);
        if (response.ok) {
          const data = await response.json();
          setComments(data.comments || []);
        }
      } catch (err) {
        console.error('Failed to fetch comments:', err);
      } finally {
        setIsLoadingComments(false);
      }
    };

    if (postId && post) {
      fetchComments();
    }
  }, [postId, post]);

  // 이미지 목록 조회
  useEffect(() => {
    const fetchImages = async () => {
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

    if (postId && post) {
      fetchImages();
    }
  }, [postId, post]);

  // 목록으로 돌아가기
  const handleGoBack = () => {
    router.push('/community');
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 멘션 파싱 및 렌더링
  const renderContentWithMentions = (content: string) => {
    const mentionRegex = /@(\S+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // 멘션 이전 텍스트
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      
      // 멘션 부분 (하이라이트)
      parts.push(
        <span key={match.index} className="text-primary font-medium bg-primary/10 px-1 rounded">
          @{match[1]}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }

    // 남은 텍스트
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  // 게시글 수정
  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  // 수정 성공 시
  const handleEditSuccess = () => {
    // 게시글 다시 조회
    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/community/posts/${postId}`);
        if (response.ok) {
          const data: PostDetailResponse = await response.json();
          setPost(data);
        }
      } catch (err) {
        console.error('Failed to refresh post:', err);
      }
    };
    fetchPost();
  };

  // 좋아요 토글 (LocalStorage + DB 하이브리드)
  const handleLikeToggle = async () => {
    if (isLiking) return;

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
          
          if (post) {
            setPost({
              ...post,
              like_count: data.liked ? post.like_count + 1 : post.like_count - 1,
            });
          }
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
          if (alreadyLiked) {
            // 좋아요 취소
            const newLikedPosts = likedPosts.filter(id => id !== postIdNum);
            localStorage.setItem('liked_posts', JSON.stringify(newLikedPosts));
            setIsLiked(false);
            if (post) {
              setPost({ ...post, like_count: post.like_count - 1 });
            }
          } else {
            // 좋아요 추가
            likedPosts.push(postIdNum);
            localStorage.setItem('liked_posts', JSON.stringify(likedPosts));
            setIsLiked(true);
            if (post) {
              setPost({ ...post, like_count: post.like_count + 1 });
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    } finally {
      setIsLiking(false);
    }
  };

  // 비회원 닉네임 생성 함수
  const getAnonymousNickname = (): string => {
    // LocalStorage에서 기존 닉네임 확인
    let nickname = localStorage.getItem('anonymous_nickname');
    
    if (!nickname) {
      // 랜덤 4자리 숫자 생성
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      nickname = `익명${randomNum}`;
      localStorage.setItem('anonymous_nickname', nickname);
    }
    
    return nickname;
  };

  // 댓글 작성
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      // 로그인 사용자: 닉네임 사용, 비로그인: 랜덤 익명 닉네임
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
          const myComments: number[] = JSON.parse(localStorage.getItem('my_comments') || '[]');
          myComments.push(data.comment.comment_id);
          localStorage.setItem('my_comments', JSON.stringify(myComments));
        }
        
        // 댓글 목록 다시 조회
        const commentsResponse = await fetch(`/api/community/posts/${postId}/comments`);
        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          setComments(commentsData.comments || []);
        }

        // 게시글 comment_count 업데이트
        if (post) {
          setPost({ ...post, comment_count: post.comment_count + 1 });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '댓글 작성에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
      alert(err instanceof Error ? err.message : '댓글 작성에 실패했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 대댓글 작성
  const handleReplySubmit = async (parentId: number) => {
    if (!replyContent.trim()) return;

    setIsSubmittingComment(true);
    try {
      // 로그인 사용자: 닉네임 사용, 비로그인: 랜덤 익명 닉네임
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
          const myComments: number[] = JSON.parse(localStorage.getItem('my_comments') || '[]');
          myComments.push(data.comment.comment_id);
          localStorage.setItem('my_comments', JSON.stringify(myComments));
        }
        
        // 댓글 목록 다시 조회
        const commentsResponse = await fetch(`/api/community/posts/${postId}/comments`);
        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          setComments(commentsData.comments || []);
        }

        // 게시글 comment_count 업데이트
        if (post) {
          setPost({ ...post, comment_count: post.comment_count + 1 });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '대댓글 작성에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to submit reply:', err);
      alert(err instanceof Error ? err.message : '대댓글 작성에 실패했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 게시글 삭제
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

      // 성공: 목록으로 이동
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* 상단 네비게이션 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          목록으로
        </Button>
      </div>

      {/* 게시글 헤더 */}
      <div className="rounded-lg border border-border bg-card">
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
              <span>{formatDate(post.created_at)}</span>
              {post.created_at !== post.updated_at && (
                <span className="text-xs">(수정됨)</span>
              )}
            </div>
            
            {/* 통계 (읽기 전용) */}
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

        {/* 게시글 본문 */}
        <div className="p-6">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap break-words text-foreground">
              {post.content}
            </div>
          </div>

          {/* 이미지 미리보기 (본문 내) */}
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
          <Button
            variant="outline"
            onClick={handleGoBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록
          </Button>

          <div className="flex gap-2">
            {/* TODO: 인증 추가 후 본인 게시글만 표시 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              수정
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </Button>
          </div>
        </div>
      </div>

      {/* 좋아요 버튼 (게시글과 댓글 사이) */}
      <div className="my-6 flex justify-center">
        <Button
          size="lg"
          variant={isLiked ? "default" : "outline"}
          onClick={handleLikeToggle}
          disabled={isLiking}
          className={cn(
            "gap-2 px-8 py-6 text-lg font-semibold",
            isLiked && "bg-red-500 hover:bg-red-600 text-white border-red-500"
          )}
        >
          <ThumbsUp className={cn("h-6 w-6", isLiked && "fill-current")} />
          {isLiked ? '좋아요 취소' : '좋아요'} ({post.like_count})
        </Button>
      </div>

      {/* 첨부파일 다운로드 섹션 */}
      {!isLoadingImages && images.length > 0 && (
        <div className="my-6 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            📎 첨부파일 {images.length}개
          </h3>
          <div className="space-y-2">
            {images.map((image) => {
              // URL에서 파일명 추출
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
      )}

      {/* 댓글 섹션 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          댓글 {post.comment_count}개
        </h2>

        {/* 댓글 작성 폼 */}
        <form onSubmit={handleCommentSubmit} className="mb-6 space-y-3">
          <div className="text-xs text-muted-foreground mb-2">
            💡 모든 댓글은 "<strong>익명</strong>"으로 작성됩니다 (로그인 기능 추가 예정)
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
              <div key={comment.comment_id} className="space-y-2">
                {/* 댓글 */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    {/* 닉네임 + 날짜 (좌측) */}
                    <div className="flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {comment.author_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 내용 - 클릭 시 답글 */}
                  <div 
                    className="mt-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setReplyTo(comment.comment_id)}
                  >
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                      {renderContentWithMentions(comment.content)}
                    </p>
                  </div>
                </div>

                {/* 대댓글 개수 표시 및 스레드 토글 */}
                {comment.replies && comment.replies.length >= 5 && (
                  <div className="ml-8 mt-2">
                    <button
                      onClick={() => setExpandedThreads(prev => ({
                        ...prev,
                        [comment.comment_id]: !prev[comment.comment_id]
                      }))}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {expandedThreads[comment.comment_id] 
                        ? `답글 ${comment.replies.length}개 접기 ▲`
                        : `답글 ${comment.replies.length}개 보기 ▼`
                      }
                    </button>
                  </div>
                )}

                {/* 대댓글 목록 */}
                {comment.replies && comment.replies.length > 0 && (
                  <>
                    {/* 5개 미만: 항상 표시 */}
                    {comment.replies.length < 5 && (
                      <div className="ml-8 mt-2 space-y-2">
                        {comment.replies.map((reply) => (
                          <div key={reply.comment_id} className="rounded-lg border border-border bg-background p-3">
                            {/* 닉네임 + 날짜 */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-foreground">
                                {reply.author_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(reply.created_at)}
                              </span>
                            </div>

                            {/* 내용 (멘션 파싱) */}
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                              {renderContentWithMentions(reply.content)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 5개 이상: 펼침/접힘 */}
                    {comment.replies.length >= 5 && expandedThreads[comment.comment_id] && (
                      <div className="ml-8 mt-2 space-y-2">
                        {comment.replies.map((reply) => (
                          <div key={reply.comment_id} className="rounded-lg border border-border bg-background p-3">
                            {/* 닉네임 + 날짜 */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-foreground">
                                {reply.author_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(reply.created_at)}
                              </span>
                            </div>

                            {/* 내용 (멘션 파싱) */}
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                              {renderContentWithMentions(reply.content)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
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
                          onClick={() => handleReplySubmit(comment.comment_id)}
                          disabled={isSubmittingComment}
                        >
                          {isSubmittingComment ? (
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
            ))}
          </div>
        )}
      </div>

      {/* 수정 다이얼로그 */}
      {post && (
        <EditPostDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          post={post}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>게시글 삭제</DialogTitle>
            <DialogDescription>
              정말로 이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
