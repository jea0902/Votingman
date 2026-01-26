"use client";

/**
 * TradingView Ticker Tape (상단 티커 띠)
 *
 * 설계 의도:
 * - 맨 상단에 고정되어 주요 지수/암호화폐 가격을 실시간으로 표시
 * - TradingView 공식 위젯 스크립트 사용
 * - Deep Dark 테마와 조화
 * - 사이즈 compact로 수정
 */

import { useEffect, useRef } from "react";

export function TickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || scriptLoadedRef.current) return;

    try {
      // TradingView Ticker Tape 스크립트 동적 로드
      const script = document.createElement("script");
      script.type = "module";
      script.src = "https://widgets.tradingview-widget.com/w/kr/tv-ticker-tape.js";
      script.async = true;

      script.onload = () => {
        scriptLoadedRef.current = true;
      };

      script.onerror = () => {
        console.error("[TickerTape] 스크립트 로드 실패");
      };

      // 커스텀 엘리먼트 생성
      const tickerElement = document.createElement("tv-ticker-tape");
      tickerElement.setAttribute(
        "symbols",
        "FOREXCOM:SPXUSD,FOREXCOM:NSXUSD,FOREXCOM:DJI,FX:EURUSD,BITSTAMP:BTCUSD,BITSTAMP:ETHUSD,CMCMARKETS:GOLD"
      );
      tickerElement.setAttribute("theme", "dark");
      tickerElement.setAttribute("item-size", "compact");
      tickerElement.setAttribute("isTransparent", "false");
      tickerElement.setAttribute("displayMode", "adaptive");
      tickerElement.setAttribute("locale", "kr");

      containerRef.current.appendChild(tickerElement);
      document.head.appendChild(script);

      return () => {
        try {
          if (script.parentNode) {
            document.head.removeChild(script);
          }
        } catch {
          /* noop */
        }
      };
    } catch (e) {
      console.error("[TickerTape] 초기화 오류:", e);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full bg-card"
      style={{ minHeight: "46px" }}
    />
  );
}
