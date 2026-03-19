"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreatePostDialog } from "@/components/community/CreatePostDialog";
import type { PostListItem, PostListResponse } from "@/lib/supabase/db-types";
import { Bookmark, Heart, Link2, Loader2, MessageCircle, MessageSquare, PenSquare } from "lucide-react";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

type CommunityFeedProps = {
  title?: string;
  description?: string;
  pageSize?: number;
  showIntegrationNotice?: boolean;
};

export function CommunityFeed({
  title = "커뮤니티 피드",
  description = "코인 인사이트, 차트 관점, 전략 아이디어를 글과 이미지로 공유하세요.",
  pageSize = 10,
  showIntegrationNotice = false,
}: CommunityFeedProps) {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [imageByPost, setImageByPost] = useState<Record<number, string | null>>({});
  const [expandedPost, setExpandedPost] = useState<Record<number, boolean>>({});

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        board_type: "free",
        page: String(page),
        page_size: String(pageSize),
      });
      const response = await fetch(`/api/community/posts?${params}`);
      if (!response.ok) {
        throw new Error("게시글을 불러오는데 실패했습니다.");
      }
      const data: PostListResponse = await response.json();
      setPosts(data.posts ?? []);
      setTotalPages(data.total_pages ?? 1);
    } catch (err) {
      console.error("[CommunityFeed] fetch failed:", err);
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (posts.length === 0) {
      setImageByPost({});
      return;
    }

    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        posts.map(async (post) => {
          try {
            const res = await fetch(`/api/community/posts/${post.post_id}/images`);
            if (!res.ok) return { postId: post.post_id, imageUrl: null as string | null };
            const data = await res.json();
            const imageUrl = data?.images?.[0]?.image_url ?? null;
            return { postId: post.post_id, imageUrl };
          } catch {
            return { postId: post.post_id, imageUrl: null as string | null };
          }
        })
      );
      if (cancelled) return;
      const map: Record<number, string | null> = {};
      results.forEach((r) => {
        map[r.postId] = r.imageUrl;
      });
      setImageByPost(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [posts]);

  const handleCreateSuccess = () => {
    setPage(1);
    fetchPosts();
  };

  return (
    <section className="space-y-4" aria-label="커뮤니티 피드">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {showIntegrationNotice && (
              <p className="mt-2 text-xs text-primary">커뮤니티 기능이 홈 중심으로 통합되었습니다.</p>
            )}
          </div>
          <Button size="lg" className="shrink-0 gap-2 self-start sm:self-center" onClick={() => setIsCreateDialogOpen(true)}>
            <PenSquare className="h-4 w-4" />
            글/사진 올리기
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading && (
          <div className="flex flex-col items-center justify-center px-4 py-14">
            <Loader2 className="mb-3 h-7 w-7 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">피드를 불러오는 중...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center px-4 py-14">
            <p className="mb-3 text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchPosts}>
              다시 시도
            </Button>
          </div>
        )}

        {!isLoading && !error && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-14">
            <MessageSquare className="mb-3 h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">아직 게시글이 없습니다. 첫 글을 남겨보세요.</p>
          </div>
        )}

        {!isLoading && !error && posts.length > 0 && (
          <div className="space-y-3 p-3">
            {posts.map((post) => (
              <article
                key={post.post_id}
                className="overflow-hidden rounded-xl border border-border bg-background"
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                      {post.author_name.slice(0, 1)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{post.author_name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(post.created_at)}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={(e) => e.preventDefault()}
                  >
                    팔로우
                  </Button>
                </div>

                {imageByPost[post.post_id] && (
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => router.push(`/community/posts/${post.post_id}`)}
                  >
                    <img
                      src={imageByPost[post.post_id] as string}
                      alt={post.title}
                      className="h-64 w-full object-cover sm:h-80"
                    />
                  </button>
                )}

                <div className="px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">{post.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {expandedPost[post.post_id]
                      ? post.content ?? ""
                      : (post.content ?? "").slice(0, 120)}
                    {(post.content?.length ?? 0) > 120 && (
                      <button
                        type="button"
                        className="ml-1 font-medium text-foreground underline underline-offset-2"
                        onClick={() =>
                          setExpandedPost((prev) => ({ ...prev, [post.post_id]: !prev[post.post_id] }))
                        }
                      >
                        {expandedPost[post.post_id] ? "접기" : "더보기"}
                      </button>
                    )}
                  </p>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button type="button" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <Heart className="h-4 w-4" />
                        <span className="text-xs">{post.like_count}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/community/posts/${post.post_id}`)}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span className="text-xs">{post.comment_count}</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const url = `${window.location.origin}/community/posts/${post.post_id}`;
                          try {
                            await navigator.clipboard.writeText(url);
                          } catch {
                            // ignore clipboard failures
                          }
                        }}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Link2 className="h-4 w-4" />
                        <span className="text-xs">공유</span>
                      </button>
                    </div>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Bookmark className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>조회 {post.view_count}</span>
                    {post.is_pinned && <span className="text-primary">공지</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {!isLoading && !error && totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            이전
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            다음
          </Button>
        </div>
      )}

      <CreatePostDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        boardType="free"
        onSuccess={handleCreateSuccess}
      />
    </section>
  );
}

