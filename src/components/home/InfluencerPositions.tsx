"use client";

/**
 * 트레이딩 인플루언서 실시간 포지션
 *
 * 설계 의도:
 * - 유명 트레이더/인플루언서들의 현재 포지션 표시
 * - 8단계: 크롤러/연동 API 연동 예정. 현재는 샘플 데이터 표시.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InfluencerPosition {
  id: string;
  name: string;
  avatar: string;
  rank: number;
  symbol: string;
  position: "Long" | "Short";
  entryPrice: number;
  marketPrice: number;
  pnlUsdt: number;
  isLive: boolean;
}

/** 크롤러/API 연동 전까지 샘플 데이터 (UI 미리보기용) */
const SAMPLE_INFLUENCERS: InfluencerPosition[] = [
  {
    id: "1",
    name: "박호두",
    avatar: "/avatars/influencer-parkhodu.jpg",
    rank: 1,
    symbol: "BTCUSDT",
    position: "Long",
    entryPrice: 72092.7,
    marketPrice: 70837.89,
    pnlUsdt: -151135.47,
    isLive: true,
  },
  {
    id: "2",
    name: "짭구",
    avatar: "/avatars/influencer-jjapgu.jpg",
    rank: 2,
    symbol: "BTCUSDT",
    position: "Long",
    entryPrice: 77207.3,
    marketPrice: 70837.89,
    pnlUsdt: -101910.57,
    isLive: true,
  },
  {
    id: "3",
    name: "사또",
    avatar: "/avatars/influencer-satto.jpg",
    rank: 3,
    symbol: "ETHUSDT",
    position: "Long",
    entryPrice: 2300.39,
    marketPrice: 2099.89,
    pnlUsdt: -27345.4,
    isLive: true,
  },
  {
    id: "4",
    name: "웨돔",
    avatar: "/avatars/influencer-wedom.jpg",
    rank: 4,
    symbol: "BTCUSDT",
    position: "Long",
    entryPrice: 77207.3,
    marketPrice: 70837.89,
    pnlUsdt: 16000.0,
    isLive: true,
  },
];

function PositionCard({ influencer }: { influencer: InfluencerPosition }) {
  const isProfit = influencer.pnlUsdt > 0;
  const isLoss = influencer.pnlUsdt < 0;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      {/* 상단: 프로필 + 이름 + 상태 */}
      <div className="mb-3 flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {influencer.avatar ? (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/20 to-chart-2/20 text-xs font-medium text-muted-foreground">
              {influencer.name.charAt(0)}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
              ?
            </div>
          )}
          {influencer.isLive && (
            <div className="absolute left-1 top-1 flex h-4 w-8 items-center justify-center rounded bg-chart-2 text-[10px] font-bold text-white">
              ON
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {influencer.name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs">
            <span className="font-medium text-foreground">{influencer.symbol}</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                influencer.position === "Long"
                  ? "bg-chart-2/20 text-chart-2"
                  : "bg-chart-4/20 text-chart-4"
              )}
            >
              {influencer.position}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-muted-foreground">미실현 손익</div>
          <div
            className={cn(
              "text-sm font-bold tabular-nums",
              isProfit && "text-chart-2",
              isLoss && "text-chart-4",
              !isProfit && !isLoss && "text-muted-foreground"
            )}
          >
            {isProfit ? "+" : ""}
            {influencer.pnlUsdt.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      {/* 하단: 가격 정보 */}
      {influencer.isLive && influencer.entryPrice > 0 && (
        <div className="flex gap-2 text-xs">
          <div className="flex-1 rounded bg-muted/50 px-2 py-1.5">
            <div className="mb-0.5 text-[10px] text-muted-foreground">진입가</div>
            <div className="font-medium tabular-nums text-foreground">
              {influencer.entryPrice.toLocaleString()}
            </div>
          </div>
          <div className="flex-1 rounded bg-muted/50 px-2 py-1.5">
            <div className="mb-0.5 text-[10px] text-muted-foreground">시장 평균가</div>
            <div className="font-medium tabular-nums text-foreground">
              {influencer.marketPrice.toLocaleString()}
            </div>
          </div>
          <div className="flex-1 rounded bg-muted/50 px-2 py-1.5">
            <div className="mb-0.5 text-[10px] text-muted-foreground">청산가</div>
            <div className="font-medium tabular-nums text-foreground">
              {(influencer.entryPrice * 0.92).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {influencer.isLive && influencer.entryPrice === 0 && (
        <div className="rounded bg-muted/30 px-2 py-2 text-center text-xs text-muted-foreground">
          포지션 정보 없음
        </div>
      )}
    </div>
  );
}

export function InfluencerPositions({ className }: { className?: string }) {
  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">코인 유튜버 실시간 포지션</CardTitle>
        <p className="text-xs text-muted-foreground">
          롱/숏 비율 및 실시간 수익률 · 크롤러/API 연동 예정 (현재 샘플)
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {SAMPLE_INFLUENCERS.map((influencer) => (
          <PositionCard key={influencer.id} influencer={influencer} />
        ))}
      </CardContent>
    </Card>
  );
}
