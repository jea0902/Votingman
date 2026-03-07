"use client";

/**
 * Lightweight Charts – 코스피(KOSPI) 차트
 * - Yahoo Finance ^KS11 → /api/sentiment/kospi-klines
 * - BTC 차트와 동일 UI/테마 (1분/15분/1시간/5분/1일봉)
 */

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineStyle,
  type UTCTimestamp,
} from "lightweight-charts";
import { cn } from "@/lib/utils";

type ChartInterval = "1m" | "5m" | "15m" | "1h" | "1d";

const INTERVAL_ORDER: ChartInterval[] = ["1m", "5m", "15m", "1h", "1d"];
const INTERVAL_LABELS: Record<ChartInterval, string> = {
  "1m": "1분",
  "5m": "5분",
  "15m": "15분",
  "1h": "1시간",
  "1d": "1일",
};

const THEME = {
  bgCard: "#0f1629",
  bgBtnBar: "#0b1020",
  borderCard: "rgba(255,255,255,0.08)",
  borderActive: "#2563eb",
  gridLine: "rgba(255,255,255,0.04)",
  textPrimary: "rgba(255,255,255,0.55)",
  textMuted: "rgba(255,255,255,0.28)",
  textActive: "#60a5fa",
  crosshair: "rgba(96,165,250,0.4)",
  labelBg: "#1a3568",
  candleUp: "#26a69a",
  candleDown: "#ef5350",
  targetLine: "#f59e0b",
  glowBlue: "rgba(37,99,235,0.5)",
  glowCyan: "rgba(96,165,250,0.35)",
  bgBtnActive: "rgba(37,99,235,0.2)",
};

type CandlestickData = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

async function fetchKospiKlines(interval: ChartInterval): Promise<CandlestickData[]> {
  const res = await fetch(`/api/sentiment/kospi-klines?interval=${interval}`);
  const json = await res.json();
  if (!json?.success || !Array.isArray(json?.data)) return [];
  return json.data as CandlestickData[];
}

type Props = {
  targetPrice?: number | null;
  defaultInterval?: ChartInterval;
  className?: string;
};

export function KospiChart({
  targetPrice,
  defaultInterval = "1d",
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ReturnType<ReturnType<typeof createChart>["addSeries"]> | null>(null);

  const [chartInterval, setChartInterval] = useState<ChartInterval>(defaultInterval);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: THEME.bgCard },
        textColor: THEME.textPrimary,
        fontSize: 11,
        fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
      },
      grid: {
        vertLines: { color: THEME.gridLine },
        horzLines: { color: THEME.gridLine },
      },
      width: containerRef.current.clientWidth,
      height: 440,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: THEME.borderCard,
        minBarSpacing: 2,
        barSpacing: 8,
        rightOffset: 10,
      },
      rightPriceScale: {
        borderColor: THEME.borderCard,
        textColor: THEME.textPrimary,
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: THEME.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: THEME.labelBg,
        },
        horzLine: {
          color: THEME.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: THEME.labelBg,
        },
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: THEME.candleUp,
      downColor: THEME.candleDown,
      borderUpColor: THEME.candleUp,
      borderDownColor: THEME.candleDown,
      wickUpColor: THEME.candleUp,
      wickDownColor: THEME.candleDown,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRef.current = series;

    if (targetPrice != null && targetPrice > 0) {
      series.createPriceLine({
        price: targetPrice,
        color: THEME.targetLine,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "목표가",
      });
    }

    const handleResize = () => {
      if (containerRef.current && chartRef.current)
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      seriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [targetPrice]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchKospiKlines(chartInterval)
      .then((data) => {
        if (cancelled || !seriesRef.current || !chartRef.current || data.length === 0) return;

        seriesRef.current.setData(data);

        const len = data.length;
        const visible = Math.min(60, len);
        const recentData = data.slice(len - visible);
        let minPrice = Math.min(...recentData.map((c) => c.low));
        let maxPrice = Math.max(...recentData.map((c) => c.high));
        if (targetPrice != null && targetPrice > 0) {
          minPrice = Math.min(minPrice, targetPrice);
          maxPrice = Math.max(maxPrice, targetPrice);
        }
        const padding = (maxPrice - minPrice) * 0.15;
        seriesRef.current.applyOptions({
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: minPrice - padding, maxValue: maxPrice + padding },
            margins: { above: 0, below: 0 },
          }),
        });

        chartRef.current.timeScale().setVisibleLogicalRange({
          from: len - visible,
          to: len + 3,
        });

        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("차트 데이터를 불러올 수 없습니다.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chartInterval, targetPrice]);

  if (error) {
    return (
      <div
        className={cn("flex h-[500px] items-center justify-center rounded-2xl", className)}
        style={{ background: THEME.bgCard, border: `1px solid ${THEME.borderCard}` }}
      >
        <p className="text-sm" style={{ color: THEME.textMuted }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl", className)}
      style={{
        background: THEME.bgCard,
        border: `1px solid ${THEME.borderCard}`,
        boxShadow: "0 0 0 1px rgba(37,99,235,0.08), 0 8px 40px rgba(4,7,18,0.7)",
      }}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-10"
        style={{
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${THEME.glowBlue}, ${THEME.glowCyan}, ${THEME.glowBlue}, transparent)`,
        }}
      />

      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: THEME.bgBtnBar, borderBottom: `1px solid ${THEME.borderCard}` }}
      >
        <div className="flex items-center gap-1">
          {INTERVAL_ORDER.map((iv) => {
            const isActive = chartInterval === iv;
            return (
              <button
                key={iv}
                type="button"
                onClick={() => setChartInterval(iv)}
                style={{
                  background: isActive ? THEME.bgBtnActive : "transparent",
                  border: `1px solid ${isActive ? THEME.borderActive : "transparent"}`,
                  color: isActive ? THEME.textActive : THEME.textMuted,
                  borderRadius: "7px",
                  padding: "4px 14px",
                  fontSize: "12px",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.color = THEME.textMuted;
                }}
              >
                {INTERVAL_LABELS[iv]}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: "11px", color: THEME.textMuted }}>코스피 (Yahoo Finance)</span>
      </div>

      {loading && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
          style={{ background: "rgba(8,13,26,0.9)" }}
        >
          <div
            className="h-6 w-6 animate-spin rounded-full border-2"
            style={{ borderColor: `${THEME.borderActive} transparent transparent transparent` }}
          />
          <span className="text-xs tracking-wide" style={{ color: THEME.textMuted }}>
            차트 불러오는 중…
          </span>
        </div>
      )}

      <div ref={containerRef} />

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
        style={{
          height: "24px",
          background: `linear-gradient(to bottom, transparent, ${THEME.bgCard})`,
        }}
      />
    </div>
  );
}
