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
];

function PositionCard({ influencer }: { influencer: InfluencerPosition }) {
  const isProfit = influencer.pnlUsdt > 0;
  const isLoss = influencer.pnlUsdt < 0;

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-muted/20 p-3">
      {/* 상단: 프로필 + 이름 + 상태 */}
      <div className="mb-3 flex min-w-0 items-start gap-2 sm:gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-12 sm:w-12">
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
            <div className="absolute left-0.5 top-0.5 flex h-3.5 w-6 items-center justify-center rounded bg-chart-2 text-[9px] font-bold text-white sm:h-4 sm:w-8 sm:text-[10px]">
              ON
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">
              {influencer.name}
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
            <span className="truncate font-medium text-foreground">{influencer.symbol}</span>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                influencer.position === "Long"
                  ? "bg-chart-2/20 text-chart-2"
                  : "bg-chart-4/20 text-chart-4"
              )}
            >
              {influencer.position}
            </span>
          </div>
        </div>
        <div className="min-w-0 shrink-0 text-right">
          <div className="truncate text-[10px] text-muted-foreground sm:text-xs">미실현 손익</div>
          <div
            className={cn(
              "truncate text-xs font-bold tabular-nums sm:text-sm",
              isProfit && "text-chart-2",
              isLoss && "text-chart-4",
              !isProfit && !isLoss && "text-muted-foreground"
            )}
            title={`${isProfit ? "+" : ""}${influencer.pnlUsdt.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
          >
            {isProfit ? "+" : ""}
            {influencer.pnlUsdt.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
      </div>

      {/* 하단: 가격 정보 */}
      {influencer.isLive && influencer.entryPrice > 0 && (
        <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
          <div className="min-w-0 overflow-hidden rounded bg-muted/20 px-1.5 py-1.5 sm:px-2">
            <div className="mb-0.5 truncate text-[9px] text-muted-foreground sm:text-[10px]">진입가</div>
            <div className="truncate text-[10px] font-medium tabular-nums text-foreground sm:text-xs">
              {influencer.entryPrice >= 10000
                ? `${(influencer.entryPrice / 1000).toFixed(1)}K`
                : influencer.entryPrice.toLocaleString()}
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded bg-muted/20 px-1.5 py-1.5 sm:px-2">
            <div className="mb-0.5 truncate text-[9px] text-muted-foreground sm:text-[10px]">시장가</div>
            <div className="truncate text-[10px] font-medium tabular-nums text-foreground sm:text-xs">
              {influencer.marketPrice >= 10000
                ? `${(influencer.marketPrice / 1000).toFixed(1)}K`
                : influencer.marketPrice.toLocaleString()}
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded bg-muted/20 px-1.5 py-1.5 sm:px-2">
            <div className="mb-0.5 truncate text-[9px] text-muted-foreground sm:text-[10px]">청산가</div>
            <div className="truncate text-[10px] font-medium tabular-nums text-foreground sm:text-xs">
              {influencer.entryPrice * 0.92 >= 10000
                ? `${((influencer.entryPrice * 0.92) / 1000).toFixed(1)}K`
                : (influencer.entryPrice * 0.92).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {influencer.isLive && influencer.entryPrice === 0 && (
        <div className="rounded bg-muted/20 px-2 py-2 text-center text-xs text-muted-foreground">
          포지션 정보 없음
        </div>
      )}
    </div>
  );
}

export function InfluencerPositions({ className }: { className?: string }) {
  return (
    <Card className={cn("min-w-0 overflow-hidden border-border bg-muted/20", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">코인 선물 유튜버 3대장 - 실시간 포지션</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_INFLUENCERS.map((influencer) => (
            <PositionCard key={influencer.id} influencer={influencer} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
