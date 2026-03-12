"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, RefreshCw, Loader2, UserPlus, Vote, Eye, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { DailyStatsChart } from "./DailyStatsChart";

interface AdminStats {
  activeUserCount: number;
  todayActiveUserCount: number;
  todaySignups: number;
  todayVotes: number;
  todayPageViews: number;
}

function StatCard({
  title,
  value,
  icon: Icon,
  suffix = "",
  isLoading,
}: {
  title: string;
  value: number | null;
  icon: React.ComponentType<{ className?: string }>;
  suffix?: string;
  isLoading: boolean;
}) {
  return (
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
}

export function ActiveStatusTab() {
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
  }, [fetchStats]);

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="최근 5분 내 활성 유저 수"
          value={stats?.activeUserCount ?? null}
          icon={Users}
          suffix="명"
          isLoading={isLoading}
        />
        <StatCard
          title="오늘 누적 활성 유저 수"
          value={stats?.todayActiveUserCount ?? null}
          icon={UserCheck}
          suffix="명"
          isLoading={isLoading}
        />
        <StatCard
          title="오늘 가입자 수"
          value={stats?.todaySignups ?? null}
          icon={UserPlus}
          suffix="명"
          isLoading={isLoading}
        />
        <StatCard
          title="오늘 투표 수"
          value={stats?.todayVotes ?? null}
          icon={Vote}
          suffix="건"
          isLoading={isLoading}
        />
        <StatCard
          title="오늘 페이지뷰"
          value={stats?.todayPageViews ?? null}
          icon={Eye}
          suffix="회"
          isLoading={isLoading}
        />
      </div>

      <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading}>
        <RefreshCw className={cn("h-4 w-4 shrink-0", isLoading && "animate-spin")} />
        새로고침
      </Button>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">일별 성장 (활성 유저 · 투표 수)</CardTitle>
          <p className="text-sm text-muted-foreground">
            시장 분위기 미결제약정 그래프와 동일한 구조. 매일 KST 23:59 크론 실행 후 갱신.
          </p>
        </CardHeader>
        <CardContent>
          <DailyStatsChart />
        </CardContent>
      </Card>
    </div>
  );
}
