"use client";

/**
 * Lightweight Charts – 비트코인 가격 차트
 * Binance 1분봉 OHLC 데이터 + 목표가(시가) 수평선, 30초마다 자동 갱신
 */

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineStyle,
  type UTCTimestamp,
} from "lightweight-charts";
import { cn } from "@/lib/utils";

type CandlestickData = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

async function fetchBtcKlines(): Promise<CandlestickData[]> {
  const res = await fetch(`/api/sentiment/btc-klines?t=${Date.now()}`);
  const json = await res.json();
  const data = json?.success ? json.data : null;
  if (!Array.isArray(data)) return [];
  return data.map((candle) => {
    const [openTime, open, high, low, close] = candle as [number, string, string, string, string];
    return {
      time: Math.floor(openTime / 1000) as UTCTimestamp,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
    };
  });
}

type Props = {
  targetPrice?: number | null;
  className?: string;
};

export function BtcChart({ targetPrice, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ReturnType<ReturnType<typeof createChart>["addSeries"]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(42, 46, 57, 0.5)" },
        horzLines: { color: "rgba(42, 46, 57, 0.5)" },
      },
      width: containerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "rgba(197, 203, 206, 0.2)",
        minBarSpacing: 2,
        barSpacing: 4,
      },
      rightPriceScale: {
        borderColor: "rgba(197, 203, 206, 0.2)",
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(224, 227, 235, 0.5)",
          width: 1,
        },
        horzLine: {
          color: "rgba(224, 227, 235, 0.5)",
          width: 1,
        },
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderDownColor: "#ef5350",
      borderUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRef.current = series;

    if (targetPrice != null && targetPrice > 0) {
      series.createPriceLine({
        price: targetPrice,
        color: "#f59e0b",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "목표가",
      });
    }

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    let cancelled = false;

    const loadData = () => {
      fetchBtcKlines()
        .then((data) => {
          if (cancelled || !seriesRef.current || data.length === 0) return;
          seriesRef.current.setData(data);
          chartRef.current?.timeScale().fitContent();
          setLoading(false);
          setError(null);
        })
        .catch(() => {
          if (!cancelled) {
            setError("차트 데이터를 불러올 수 없습니다.");
            setLoading(false);
          }
        });
    };

    loadData();
    const interval = setInterval(loadData, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("resize", handleResize);
      seriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [targetPrice]);

  if (error) {
    return (
      <div
        className={cn(
          "flex h-[500px] items-center justify-center rounded-lg border border-border bg-card",
          className
        )}
      >
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80">
          <span className="text-sm text-muted-foreground">차트 불러오는 중…</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="rounded-lg border border-border bg-card"
        style={{ height: 500 }}
      />
    </div>
  );
}
