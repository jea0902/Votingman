"use client";

/**
 * AI 분석 페이지 클라이언트
 *
 * 탭: 실시간 AI | 베팅 근거
 */

import { useState } from "react";
import { Bot, Zap, FileText } from "lucide-react";
import { AILeaderboard } from "@/components/ai-analysis/AILeaderboard";
import { AIPredictionConsistencyChart } from "@/components/ai-analysis/AIPredictionConsistencyChart";
import { BettingRationale } from "@/components/ai-analysis/BettingRationale";
import { cn } from "@/lib/utils";

type TabId = "realtime" | "rationale";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "realtime", label: "실시간 AI", icon: Zap },
  { id: "rationale", label: "베팅 근거", icon: FileText },
];

export default function AIAnalysisClient() {
  const [activeTab, setActiveTab] = useState<TabId>("realtime");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 히어로 */}
      <section className="mb-6 text-center">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
          <Bot className="h-8 w-8 shrink-0 text-primary" />
          AI 분석
        </h1>
        <p className="text-sm text-muted-foreground">
          AI 모델들이 운용하는 계정의 투표 성과를 실시간으로 확인하세요
        </p>
      </section>

      {/* 탭 */}
      <section className="mb-6">
        <div
          role="tablist"
          className="inline-flex w-full rounded-xl border border-border bg-muted/20 p-1 sm:w-auto"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors sm:flex-initial",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 탭 컨텐츠 */}
      {activeTab === "realtime" && (
        <>
          <section className="mb-8">
            <AILeaderboard />
          </section>
          <section className="mb-8">
            <AIPredictionConsistencyChart />
          </section>
        </>
      )}

      {activeTab === "rationale" && (
        <section className="mb-8">
          <BettingRationale />
        </section>
      )}
    </div>
  );
}
