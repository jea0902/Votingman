"use client";

/**
 * TradingView 경제 캘린더
 *
 * 설계 의도:
 * - 주요 국가의 경제 이벤트를 실시간으로 표시
 * - Deep Dark 테마
 * - 왼쪽 사이드바에 배치
 * - 에러 처리 포함
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface EconomicCalendarProps {
  className?: string;
}

export function EconomicCalendar({ className }: EconomicCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // TradingView Economic Calendar 스크립트 동적 로드
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        colorTheme: "dark",
        isTransparent: false,
        locale: "kr",
        countryFilter: "ar,au,br,ca,cn,fr,de,in,id,it,jp,kr,mx,ru,sa,za,tr,gb,us,eu",
        importanceFilter: "0,1",
        width: "100%",
        height: "100%"
      });

      script.onload = () => {
        setLoading(false);
        setError(null);
      };

      script.onerror = () => {
        setError("경제 캘린더 스크립트를 불러올 수 없습니다.");
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
      const msg = e instanceof Error ? e.message : "경제 캘린더를 불러올 수 없습니다.";
      setError(msg);
      setLoading(false);
    }
  }, []);

  if (error) {
    return (
      <div
        className={cn(
          "flex min-h-[400px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-6",
          className
        )}
        role="alert"
      >
        <p className="text-sm text-muted-foreground">경제 캘린더 로딩 중 오류가 발생했습니다.</p>
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
    <div className={cn("relative w-full h-full", className)}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80">
          <span className="text-sm text-muted-foreground">경제 캘린더 불러오는 중…</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full h-full rounded-lg border border-border bg-card overflow-hidden"
      >
        <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}
