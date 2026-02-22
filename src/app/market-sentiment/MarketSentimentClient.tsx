"use client";

/**
 * 시장 분위기 페이지 (구 고수 포지션)
 *
 * - 바이낸스 공식 API 기반 팩트 데이터만 표시
 * - 롱/숏 비율, 고래 롱/숏, 테이커 비율, 펀딩비율, 실시간 청산
 */

import { useEffect, useState, useCallback } from "react";
import { LongShortRatio } from "@/components/market-sentiment/LongShortRatio";
import { TakerRatio } from "@/components/market-sentiment/TakerRatio";
import { FundingRate } from "@/components/market-sentiment/FundingRate";
import { LiquidationFeed } from "@/components/market-sentiment/LiquidationFeed";
import { InfluencerPositions } from "@/components/home";
import { OpenInterestChart } from "@/components/market-sentiment/OpenInterestChart";


interface MarketData {
  longShort: { btc: any; eth: any };
  whale: { btc: any; eth: any };
  taker: { btc: any; eth: any };
  funding: { btc: any; eth: any; xrp: any };
  liquidations: any[];
  prices: { btc: string | null; eth: string | null };
  updatedAt: string;
}

export default function MarketSentimentClient() {
  const [data, setData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [countdown, setCountdown] = useState(30);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/market-sentiment");
      if (!res.ok) throw new Error("데이터 로드 실패");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString("ko-KR"));
      setCountdown(30);
      setError(null);
    } catch (e) {
      setError("바이낸스 데이터를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // 카운트다운
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative min-w-0 w-full">
      <div className="mx-auto flex min-w-0 w-full max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8 py-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">시장 분위기</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              바이낸스 공식 API · 실제 데이터만 표시
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">업데이트 {lastUpdated}</div>
                <div className="text-xs text-muted-foreground/60">{countdown}초 후 갱신</div>
              </div>
            )}
            <button
              onClick={fetchData}
              className="rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 인플루언서 포지션 */}
        <InfluencerPositions />

        {/* 로딩 */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl border border-border bg-muted/20 animate-pulse" />
            ))}
          </div>
        )}

        {/* 에러 */}
        {error && !isLoading && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-400">
            {error}
          </div>
        )}

        {/* 데이터 */}
        {data && !isLoading && (
          <>
            <LongShortRatio
              btc={data.longShort.btc}
              eth={data.longShort.eth}
              whaleBtc={data.whale.btc}
              whaleEth={data.whale.eth}
            />
            <TakerRatio
              btc={data.taker.btc}
              eth={data.taker.eth}
              btcPrice={data.prices.btc}
              ethPrice={data.prices.eth}
            />
            <FundingRate
              btc={data.funding.btc}
              eth={data.funding.eth}
              xrp={data.funding.xrp}
            />
            <LiquidationFeed data={data.liquidations} />
            <OpenInterestChart />
            <p className="text-center text-[11px] text-muted-foreground/50">
              * 모든 데이터는 바이낸스 공식 API 제공 · 투자 판단의 참고용으로만 활용하세요
            </p>
          </>
        )}
      </div>
    </div>
  );
}