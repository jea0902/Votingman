"use client";

/**
 * 베팅 근거 - 리서치 리포트
 *
 * - OpenClaw 등 로컬에서 가져오는 리서치 리포트 예시
 * - 더미데이터 (추후 API/로컬 연동 시 교체)
 */

import { FileText, Calendar, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ResearchReport = {
  id: string;
  title: string;
  date: string;
  source: string;
  summary: string;
  keyPoints: string[];
  topic?: string;
};

/** 더미 리서치 리포트 - OpenClaw 등 로컬 연동 시 교체 */
const DUMMY_REPORTS: ResearchReport[] = [
  {
    id: "1",
    title: "비트코인 ETF 유입세 지속, 3월 FOMC 전 시장 관망",
    date: "2025-03-12",
    source: "OpenClaw",
    topic: "BTC",
    summary: "블랙록 IBIT 등 현물 ETF 순유입이 9일 연속 이어지며 비트코인 가격이 68,000달러대를 유지하고 있다. 3월 FOMC(19~20일)를 앞두고 금리 인하 여부에 대한 관망세가 짙어지는 가운데, 단기 변동성 확대 가능성이 있다.",
    keyPoints: [
      "ETF 순유입 9일 연속, 기관 매수세 지속",
      "FOMC 전 금리 관망, 변동성 확대 가능",
      "68,000달러대 지지선 유지",
    ],
  },
  {
    id: "2",
    title: "이더리움 덴쿤 업그레이드 효과, L2 거래량 급증",
    date: "2025-03-11",
    source: "OpenClaw",
    topic: "ETH",
    summary: "덴쿤 업그레이드 이후 이더리움 L2(Arbitrum, Base 등) 거래량이 전주 대비 40% 이상 증가했다. 가스비 절감 효과가 본격화되며 DeFi·NFT 생태계 활성화가 예상된다.",
    keyPoints: [
      "L2 거래량 40%+ 증가",
      "가스비 절감 효과 본격화",
      "DeFi·NFT 생태계 활성화 기대",
    ],
  },
  {
    id: "3",
    title: "미국 비농업 고용 18만명, 시장 예상 하회…금리 인하 기대",
    date: "2025-03-10",
    source: "OpenClaw",
    topic: "매크로",
    summary: "12월 비농업 고용 18만명 증가로 시장 예상(22만명)을 하회했다. 실업률 3.7% 유지, 평균 시간당 임금 0.2% 상승에 그쳐 연준의 3월 금리 인하 가능성이 높아졌다.",
    keyPoints: [
      "비농업 고용 18만명(예상 22만명 하회)",
      "임금 인플레이션 압력 완화",
      "3월 FOMC 금리 인하 기대 상승",
    ],
  },
  {
    id: "4",
    title: "코인베이스 4분기 실적 호조, 기관 수요 확대",
    date: "2025-03-09",
    source: "OpenClaw",
    topic: "코인",
    summary: "코인베이스 4분기 매출이 시장 예상치를 상회하며 실적이 호조를 보였다. ETF 승인 이후 기관 고객 유입이 가속화되고 있으며, 2025년 수익성 개선이 기대된다.",
    keyPoints: [
      "4분기 매출 시장 예상치 상회",
      "기관 고객 유입 가속",
      "2025년 수익성 개선 기대",
    ],
  },
];

export function BettingRationale() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        AI 에이전트인 OpenClaw가 리서치로 수집한 리포트를 바탕으로 AI들에게 투표 근거를 제공합니다.
      </p>

      <div className="space-y-4">
        {DUMMY_REPORTS.map((report) => (
          <Card
            key={report.id}
            className="overflow-hidden rounded-xl border-border bg-muted/20 transition-colors hover:bg-muted/30"
          >
            <CardContent className="p-0">
              <div className="p-4 sm:p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {report.date}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {report.source}
                  </span>
                  {report.topic && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      <Tag className="h-3.5 w-3.5" />
                      {report.topic}
                    </span>
                  )}
                </div>

                <h3 className="mb-2 text-base font-semibold text-foreground">
                  {report.title}
                </h3>

                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                  {report.summary}
                </p>

                <ul className="space-y-1">
                  {report.keyPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-foreground/90"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
