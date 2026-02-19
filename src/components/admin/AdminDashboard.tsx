"use client";

/**
 * 관리자 대시보드 콘텐츠
 * - 최근 5분 내 활성 유저, 오늘 가입자/투표/페이지뷰
 * - 새로고침 버튼, 60초 자동 갱신
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, RefreshCw, Loader2, UserPlus, Vote, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 60_000;

interface AdminStats {
  activeUserCount: number;
  todaySignups: number;
  todayVotes: number;
  todayPageViews: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error?.message ?? "조회에 실패했습니다.");
        return;
      }

      if (json.success && json.data) {
        setStats(json.data);
      }
    } catch {
      setError("서버와 통신할 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStats]);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    suffix = "",
  }: {
    title: string;
    value: number | null;
    icon: React.ComponentType<{ className?: string }>;
    suffix?: string;
  }) => (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">조회 중...</span>
          </div>
        ) : (
          <p className="text-3xl font-bold text-foreground">
            {value !== null ? `${value}${suffix}` : "-"}
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="최근 5분 내 활성 유저 수"
          value={stats?.activeUserCount ?? null}
          icon={Users}
          suffix="명"
        />
        <StatCard
          title="오늘 가입자 수"
          value={stats?.todaySignups ?? null}
          icon={UserPlus}
          suffix="명"
        />
        <StatCard
          title="오늘 투표 수"
          value={stats?.todayVotes ?? null}
          icon={Vote}
          suffix="건"
        />
        <StatCard
          title="오늘 페이지뷰"
          value={stats?.todayPageViews ?? null}
          icon={Eye}
          suffix="회"
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={fetchStats}
        disabled={isLoading}
      >
        <RefreshCw className={cn("h-4 w-4 shrink-0", isLoading && "animate-spin")} />
        새로고침
      </Button>
    </div>
  );
}
