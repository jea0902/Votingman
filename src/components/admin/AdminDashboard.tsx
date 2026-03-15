"use client";

/**
 * 관리자 대시보드 — 탭 기반
 * 1. 활성 현황: 최근 5분/오늘 활성 유저, 가입자, 투표, 페이지뷰
 * 2. 미정산 투표 처리: 백필 후 정산 / 무효 처리
 * 3. 크론상태: 실패 로그, 미정산 복구
 * 4. 월별 보상: reward_claims 조회 및 지급 완료 처리
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Users, AlertTriangle, Clock, Gift, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActiveStatusTab } from "./ActiveStatusTab";
import { UnsettledVotesTab } from "./UnsettledVotesTab";
import { CronStatusPanel } from "./CronStatusPanel";
import { KoreaOhlcBackfillTab } from "./KoreaOhlcBackfillTab";
import { MonthlyRewardsTab } from "./MonthlyRewardsTab";

type TabId = "active" | "unsettled" | "cron" | "rewards" | "korea_ohlc";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "active", label: "활성 현황", icon: Users },
  { id: "unsettled", label: "미정산 투표 처리", icon: AlertTriangle },
  { id: "cron", label: "크론상태", icon: Clock },
  { id: "rewards", label: "월별 보상", icon: Gift },
  { id: "korea_ohlc", label: "OHLC 백필", icon: Database },
];

const VALID_TABS: TabId[] = ["active", "unsettled", "cron", "rewards", "korea_ohlc"];

export function AdminDashboard() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabId = tabParam && VALID_TABS.includes(tabParam as TabId) ? (tabParam as TabId) : "active";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam as TabId)) {
      setActiveTab(tabParam as TabId);
    }
  }, [tabParam]);

  return (
    <div className="space-y-6">
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="관리자 탭">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
                aria-selected={activeTab === tab.id}
                role="tab"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "active" && <ActiveStatusTab />}
        {activeTab === "unsettled" && <UnsettledVotesTab />}
        {activeTab === "cron" && <CronStatusPanel />}
        {activeTab === "rewards" && <MonthlyRewardsTab />}
        {activeTab === "korea_ohlc" && <KoreaOhlcBackfillTab />}
      </div>
    </div>
  );
}
