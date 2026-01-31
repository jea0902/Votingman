"use client";

/**
 * 커뮤니티 페이지 (실제 동작)
 * 
 * 설계 의도:
 * - 최소 클릭으로 즉시 행동 가능한 직관적 UI
 * - 2개 게시판: 자유게시판(자유/건의 카테고리), 관점 게시판
 * - 탭 전환으로 빠른 네비게이션
 * - 실시간 게시글 목록 조회 및 페이지네이션
 * 
 * 확장성:
 * - 인증 추가 시 로그인 상태에 따라 글쓰기 버튼 제어
 * - 댓글, 좋아요 기능 추가 가능
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

type TabType = "free" | "perspective" | "best";

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
      
      if (activeTab === 'best') {
        // 실시간 베스트 API
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: pageSize.toString(),
        });
        endpoint = `/api/community/posts/best?${params}`;
      } else {
        // 일반 게시판 API
        const params = new URLSearchParams({
          board_type: activeTab,
          page: page.toString(),
          page_size: pageSize.toString(),
        });
        endpoint = `/api/community/posts?${params}`;
      }

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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          커뮤니티
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          투자자들과 소통하고 관점을 공유하세요
        </p>
      </div>

      {/* 탭 네비게이션 */}
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
          자유게시판
          <span className="text-xs text-muted-foreground">(자유/건의)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("perspective")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "perspective"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Eye className="h-4 w-4" />
          관점 게시판
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("best")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "best"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ThumbsUp className="h-4 w-4" />
          실시간 베스트
        </button>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="space-y-6">
        {/* 글쓰기 버튼 영역 (베스트 탭에서는 숨김) */}
        {activeTab !== "best" && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div className="flex-1">
              {activeTab === "free" ? (
              <>
                <h2 className="text-lg font-semibold text-foreground">
                  자유게시판
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  투자 이야기부터 서비스 건의까지, 자유롭게 소통하세요
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-foreground">
                  관점 게시판
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  나만의 투자 관점과 인사이트를 공유하세요
                </p>
              </>
            )}
          </div>
          <Button
            size="lg"
            className="gap-2"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <PenSquare className="h-4 w-4" />
            글쓰기
          </Button>
        </div>
        )}

        {/* 베스트 탭 안내 */}
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

        {/* 게시글 목록 */}
        <div className="rounded-lg border border-border bg-card">
          {/* 목록 헤더 */}
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
              <span className="w-16 text-center">카테고리</span>
              <span className="flex-1 min-w-0">제목</span>
              <span className="hidden w-20 text-center sm:block">작성자</span>
              <span className="hidden w-12 text-center md:block">조회</span>
              <span className="hidden w-12 text-center md:block">좋아요</span>
              <span className="hidden w-20 text-center lg:block">작성일</span>
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
              <div className="rounded-full bg-muted p-4 mb-4">
                {activeTab === "free" ? (
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                ) : activeTab === "perspective" ? (
                  <Eye className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <ThumbsUp className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {activeTab === "best" 
                  ? "아직 베스트 게시글이 없습니다"
                  : "첫 게시글을 작성해보세요!"
                }
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {activeTab === "free" 
                  ? "아직 작성된 게시글이 없습니다. 첫 글을 작성해주세요."
                  : activeTab === "perspective"
                  ? "아직 공유된 관점이 없습니다. 여러분의 인사이트를 공유해주세요."
                  : "24시간 이내 좋아요 5개 이상 + 조회수 30회 이상인 게시글이 표시됩니다."
                }
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
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  {/* 카테고리 */}
                  <div className="w-16 flex-shrink-0 text-center">
                    {post.is_pinned && (
                      <span className="inline-flex items-center justify-center w-12 px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                        공지
                      </span>
                    )}
                    {!post.is_pinned && activeTab === "best" && (
                      <span className={cn(
                        "inline-flex items-center justify-center w-12 px-1.5 py-0.5 text-xs rounded-full",
                        post.board_type === 'free' 
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                      )}>
                        {post.board_type === 'free' ? '자유' : '관점'}
                      </span>
                    )}
                    {!post.is_pinned && activeTab !== "best" && post.category && (
                      <span className={cn(
                        "inline-flex items-center justify-center w-12 px-1.5 py-0.5 text-xs rounded-full",
                        post.category === 'free' 
                          ? "bg-primary/10 text-primary"
                          : "bg-accent/10 text-accent"
                      )}>
                        {post.category === 'free' ? '자유' : '건의'}
                      </span>
                    )}
                    {!post.is_pinned && activeTab !== "best" && !post.category && (
                      <span className="inline-flex items-center justify-center w-12 px-1.5 py-0.5 text-xs rounded-full bg-muted/50 text-muted-foreground">
                        관점
                      </span>
                    )}
                  </div>

                  {/* 제목 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {post.title}
                      </span>
                      {post.comment_count > 0 && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          [{post.comment_count}]
                        </span>
                      )}
                    </div>
                    {/* 모바일: 통계 */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground sm:hidden">
                      <span>{post.author_name}</span>
                      <span>조회 {post.view_count}</span>
                      <span>좋아요 {post.like_count}</span>
                    </div>
                  </div>

                  {/* 작성자 (태블릿+) */}
                  <span className="hidden w-20 text-sm text-muted-foreground text-center truncate sm:block">
                    {post.author_name}
                  </span>

                  {/* 조회수 (태블릿+) */}
                  <span className="hidden w-12 text-sm text-muted-foreground text-center md:block">
                    {post.view_count}
                  </span>

                  {/* 좋아요 수 (태블릿+) */}
                  <span className="hidden w-12 text-sm text-muted-foreground text-center md:block">
                    {post.like_count}
                  </span>

                  {/* 작성일 (데스크톱) */}
                  <span className="hidden w-20 text-xs text-muted-foreground text-center lg:block">
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
          <h3 className="text-sm font-semibold text-foreground mb-2">
            💡 커뮤니티 이용 안내
          </h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• <strong>글 작성</strong>: 로그인한 회원만 글을 작성할 수 있습니다</li>
            <li>• <strong>댓글 및 좋아요</strong>: 비회원도 가능합니다 (익명으로 표시됨)</li>
            <li>• <strong>자유게시판</strong>: 글 작성 시 [자유] 또는 [건의] 카테고리를 선택할 수 있습니다</li>
            <li>• <strong>관점 게시판</strong>: 시장 분석, 투자 전략 등 깊이 있는 인사이트를 공유하세요</li>
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

      {/* 게시글 작성 다이얼로그 */}
      {activeTab !== "best" && (
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
