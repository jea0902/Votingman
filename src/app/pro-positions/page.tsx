/**
 * 고수 포지션 페이지
 *
 * - 코인 선물 유튜버 실시간 포지션 카드
 * - 바이낸스 선물 랭커 TOP3 실시간 포지션 카드
 * (투표 페이지에서 보여주던 구성 그대로)
 */

import { InfluencerPositions, TopRankersBoard, WonyottiPosition, BitmexRankersBoard } from "@/components/home";

export default function ProPositionsPage() {
  return (
    <div className="relative min-w-0 w-full">
      <div className="mx-auto flex min-w-0 w-full max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="mb-4 flex min-h-[8vh] flex-col justify-center py-4 text-center">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-[#3b82f6] sm:text-3xl lg:text-4xl">
              고수 포지션
            </h1>
            <p className="text-base font-medium text-muted-foreground sm:text-lg lg:text-xl">
              유튜버·바이낸스 랭커 실시간 포지션
            </p>
          </div>
        </div>
        <div className="min-w-0 w-full">
          <div className="w-full space-y-6">
            <InfluencerPositions />
            <TopRankersBoard />
            <WonyottiPosition />
            <BitmexRankersBoard />
          </div>
        </div>
      </div>
    </div>
  );
}
