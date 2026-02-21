"use client";

/**
 * 건의 페이지 (커뮤니티 축소 버전)
 *
 * 설계 의도:
 * - 최소 클릭으로 서비스 건의만 받을 수 있는 단일 게시판
 * - 기존 자유/관점/실시간 베스트 구조에서 자유게시판(건의)만 사용
 *
 * 주의:
 * - 관점 게시판, 실시간 베스트 기능은 MVP에서 사용하지 않아 UI에서 숨기고
 *   관련 코드는 추후 복원을 위해 주석으로 남겨둡니다.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  MessageSquare, 
  Eye, 
  PenSquare,
  ThumbsUp,
  MessageCircle,
  Loader2,
  Pin
} from "lucide-react";
import { CreatePostDialog } from "@/components/community/CreatePostDialog";
import type { PostListItem, PostListResponse } from "@/lib/supabase/db-types";

// 관점/베스트 탭은 MVP에서 사용하지 않음. 복원 시 아래 주석을 참고하세요.
type TabType = "free"; // | "perspective" | "best";

export default function CommunityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("free");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  // 게시글 목록 조회
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      let endpoint = '';
      
      // 현재는 건의 게시판(자유 board_type)만 사용.
      // 과거 실시간 베스트 탭 로직은 아래 주석 참고.
      //
      // if (activeTab === 'best') {
      //   const params = new URLSearchParams({
      //     page: page.toString(),
      //     page_size: pageSize.toString(),
      //   });
      //   endpoint = `/api/community/posts/best?${params}`;
      // } else {
      //   const params = new URLSearchParams({
      //     board_type: activeTab,
      //     page: page.toString(),
      //     page_size: pageSize.toString(),
      //   });
      //   endpoint = `/api/community/posts?${params}`;
      // }

      const params = new URLSearchParams({
        board_type: "free",
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      endpoint = `/api/community/posts?${params}`;

      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error('게시글을 불러오는데 실패했습니다.');
      }

      const data: PostListResponse = await response.json();
      setPosts(data.posts);
      setTotalPages(data.total_pages);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page]);

  // 탭 변경 시 페이지 리셋 및 재조회
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  // 페이지 변경 또는 탭 변경 시 게시글 조회
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // 게시글 작성 성공 시
  const handleCreateSuccess = () => {
    setPage(1);
    fetchPosts();
  };

  // 게시글 클릭 시
  const handlePostClick = (postId: number) => {
    router.push(`/community/posts/${postId}`);
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">

      {/* 탭 네비게이션: 현재는 건의 게시판 단일 탭만 사용 */}
      <div className="mb-6 flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("free")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "free"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="h-4 w-4" />
          건의 게시판
        </button>
        {/* 
        <button ...>관점 게시판</button>
        <button ...>실시간 베스트</button>
        */}
      </div>
      {/* 탭 컨텐츠 */}
      <div className="space-y-6">
        {/* 글쓰기 버튼 영역 */}
        {activeTab === "free" && (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-foreground">
                건의 게시판
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                서비스 사용 중 불편했던 점이나 개선 아이디어를 남겨주세요.
              </p>
            </div>
            <Button
              size="lg"
              className="shrink-0 gap-2 self-start sm:self-center"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <PenSquare className="h-4 w-4" />
              건의 글쓰기
            </Button>
          </div>
        )}

        {/* 실시간 베스트 탭 설명은 MVP에서 사용하지 않음 (복원 시 아래 주석 참고) */}
        {/*
        {activeTab === "best" && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-lg font-semibold text-foreground">
              🔥 실시간 베스트
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              24시간 이내: 좋아요 5개 이상 + 조회수 30회 이상
            </p>
          </div>
        )}
        */}

        {/* 게시글 목록 */}
        <div className="rounded-lg border border-border bg-card">
          {/* 목록 헤더 (데스크톱) */}
          <div className="hidden border-b border-border bg-muted/30 px-4 py-3 sm:block">
              <span className="w-16 text-center">카테고리</span>
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
              <span className="flex-1 min-w-0">제목</span>
              <span className="w-20 text-center">작성자</span>
              <span className="w-12 text-center">조회</span>
              <span className="w-12 text-center">좋아요</span>
              <span className="w-20 text-center">작성일</span>
            </div>
          </div>

          {/* 로딩 상태 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">게시글을 불러오는 중...</p>
            </div>
          )}

          {/* 에러 상태 */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPosts()}
              >
                다시 시도
              </Button>
            </div>
          )}

          {/* 빈 상태 */}
          {!isLoading && !error && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="mb-4 rounded-full bg-muted p-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                아직 등록된 건의가 없습니다
              </h3>
              <p className="max-w-md text-center text-sm text-muted-foreground">
                서비스에 대한 아이디어나 개선 요청을 가장 먼저 남겨보세요.
              </p>
            </div>
          )}

          {/* 게시글 목록 */}
          {!isLoading && !error && posts.length > 0 && (
            <div className="divide-y divide-border">
              {posts.map((post) => (
                <div
                  key={post.post_id}
                  onClick={() => handlePostClick(post.post_id)}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors sm:flex-row sm:items-center sm:gap-3"
                >
                  {/* 카테고리 */}
                  <div className="w-16 flex-shrink-0 text-center">
                    {post.is_pinned && (
                      <span className="inline-flex items-center justify-center w-12 px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                        공지
                      </span>
                    )}
                    {/* 카테고리: 건의 게시판에서는 '건의' 중심으로 사용 */}
                    {!post.is_pinned && post.category && (
                      <span className={cn(
                        "inline-flex items-center justify-center w-12 px-1.5 py-0.5 text-xs rounded-full",
                        post.category === 'free' 
                          ? "bg-primary/10 text-primary"
                          : "bg-accent/10 text-accent"
                      )}>
                        {post.category === 'free' ? '자유' : '건의'}
                      </span>
                    )}
                    {!post.is_pinned && !post.category && (
                      <span className="inline-flex items-center justify-center w-12 px-1.5 py-0.5 text-xs rounded-full bg-muted/50 text-muted-foreground">
                        관점
                      </span>
                    )}
                  </div>

                  {/* 제목 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {post.is_pinned && (
                        <span className="shrink-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                          공지
                        </span>
                      )}
                      <span className="text-sm font-medium text-foreground truncate">
                        {post.title}
                      </span>
                      {post.comment_count > 0 && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          [{post.comment_count}]
                        </span>
                      )}
                    </div>
                    {/* 모바일: 제목 아래 작성자/조회/좋아요/작성일 */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground sm:hidden">
                      <span>{post.author_name}</span>
                      <span>조회 {post.view_count}</span>
                      <span>좋아요 {post.like_count}</span>
                      <span>{formatDate(post.created_at)}</span>
                    </div>
                  </div>

                  {/* 데스크톱: 작성자/조회/좋아요/작성일 */}
                  <span className="hidden w-20 truncate text-center text-sm text-muted-foreground sm:block">
                    {post.author_name}
                  </span>
                  <span className="hidden w-12 text-center text-sm text-muted-foreground md:block">
                    {post.view_count}
                  </span>
                  <span className="hidden w-12 text-center text-sm text-muted-foreground md:block">
                    {post.like_count}
                  </span>
                  <span className="hidden w-20 text-center text-xs text-muted-foreground lg:block">
                    {formatDate(post.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              이전
            </Button>
            <span className="flex items-center px-4 text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              다음
            </Button>
          </div>
        )}

        {/* 안내 카드 */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              💡 건의 게시판 이용 안내
            </h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• <strong>글 작성</strong>: 로그인한 회원만 글을 작성할 수 있습니다</li>
              <li>• <strong>댓글 및 좋아요</strong>: 비회원도 가능합니다 (익명으로 표시됨)</li>
              <li>• <strong>건의 게시판</strong>: 서비스 개선 아이디어, 버그 제보, 불편 사항 등을 자유롭게 남겨주세요</li>
              {/* <li>• <strong>관점 게시판</strong>: 시장 분석, 투자 전략 등 깊이 있는 인사이트를 공유하세요</li> */}
              <li>• <strong>설문/공지</strong>: 관리자가 작성한 공지사항은 게시판 상단에 고정됩니다</li>
            </ul>
          </div>

        {/* 주의사항 카드 */}
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <h3 className="text-sm font-semibold text-destructive mb-2">
            ⚠️ 주의사항
          </h3>
          <ul className="space-y-1 text-xs text-destructive">
            <li>• <strong>욕설 및 비하 발언, 도배</strong>는 사전 고지 없이 삭제됩니다</li>
            <li>• <strong>투자 판단 및 손실</strong>에 대한 책임은 전적으로 본인에게 있습니다</li>
            <li>• 본 커뮤니티의 모든 정보는 참고용이며, 투자 권유가 아닙니다</li>
          </ul>
        </div>
      </div>

      {/* 게시글 작성 다이얼로그 (현재는 건의 게시판만 사용) */}
      {activeTab === "free" && (
        <CreatePostDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          boardType={activeTab}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
