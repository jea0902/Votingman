"use client";

/**
 * TradingView 암호화폐 히트맵
 *
 * 설계 의도:
 * - 암호화폐 시장 전체를 시각화하여 한눈에 파악
 * - 시가총액 기반 블록 크기, 24시간 변동률 기반 색상
 * - Deep Dark 테마, 줌/툴팁 지원
 * - 에러 처리 포함
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CryptoHeatmapProps {
  className?: string;
}

export function CryptoHeatmap({ className }: CryptoHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // TradingView Crypto Heatmap 스크립트 동적 로드
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        dataSource: "Crypto",
        blockSize: "market_cap_calc",
        blockColor: "24h_close_change|5",
        locale: "kr",
        symbolUrl: "",
        colorTheme: "dark",
        hasTopBar: true,
        isDataSetEnabled: true,
        isZoomEnabled: true,
        hasSymbolTooltip: true,
        isMonoSize: true,
        width: "100%",
        height: 700
      });

      script.onload = () => {
        setLoading(false);
        setError(null);
      };

      script.onerror = () => {
        setError("히트맵 스크립트를 불러올 수 없습니다.");
        setLoading(false);
      };

      containerRef.current.appendChild(script);

      return () => {
        try {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
        } catch {
          /* noop */
        }
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "히트맵을 불러올 수 없습니다.";
      setError(msg);
      setLoading(false);
    }
  }, []);

  if (error) {
    return (
      <div
        className={cn(
          "flex min-h-[500px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-6",
          className
        )}
        role="alert"
      >
        <p className="text-sm text-muted-foreground">히트맵 로딩 중 오류가 발생했습니다.</p>
        <p className="text-xs text-muted-foreground/80">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:bg-accent/90"
        >
          새로고침
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80">
          <span className="text-sm text-muted-foreground">히트맵 불러오는 중…</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full rounded-lg border border-border bg-card overflow-hidden"
        style={{ height: "700px", minHeight: "700px" }}
      >
        <div className="tradingview-widget-container__widget" style={{ height: "calc(100% - 0px)", width: "100%" }} />
      </div>
    </div>
  );
}
