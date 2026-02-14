"use client";

/**
 * Lightweight Charts – 비트코인 가격 차트
 * 15분/1시간/4시간/1일봉 선택 가능, 목표가(시가) 수평선, 30초마다 자동 갱신
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

type ChartInterval = "1m" | "15m" | "1h" | "4h" | "1d";

/** 버튼 노출 순서: 1분 → 15분 → 1시간 → 4시간 → 1일 */
const INTERVAL_ORDER: ChartInterval[] = ["1m", "15m", "1h", "4h", "1d"];

const INTERVAL_LABELS: Record<ChartInterval, string> = {
  "1m": "1분",
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간",
  "1d": "1일",
};

/** 시간봉별 캔들 수 (Binance 최대 1000) */
const CHART_LIMIT: Record<ChartInterval, number> = {
  "1m": 1000,
  "15m": 1000,
  "1h": 500,
  "4h": 400,
  "1d": 365,
};

/** 시간봉 전환 후 처음 보여줄 캔들 수 (압축되지 않고 보기 좋게) */
const DEFAULT_VISIBLE_BARS = 80;

/** 첫 로딩 시 요청할 캔들 수 (적을수록 차트가 빨리 뜸, 스크롤 시 추가 로드) */
const INITIAL_LOAD_LIMIT = 120;

/** 좌측 끝에서 이만큼 안쪽이 보이면 과거 캔들 추가 로드 */
const LOAD_MORE_THRESHOLD = 40;

type CandlestickData = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

function parseKline(candle: [number, string, string, string, string]): CandlestickData {
  const [openTime, open, high, low, close] = candle;
  return {
    time: Math.floor(openTime / 1000) as UTCTimestamp,
    open: parseFloat(open),
    high: parseFloat(high),
    low: parseFloat(low),
    close: parseFloat(close),
  };
}

async function fetchBtcKlines(
  interval: ChartInterval,
  options?: { endTimeMs?: number; limit?: number }
): Promise<CandlestickData[]> {
  const limit =
    options?.limit ?? (options?.endTimeMs != null ? CHART_LIMIT[interval] : INITIAL_LOAD_LIMIT);
  const url = new URL("/api/sentiment/btc-klines", window.location.origin);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("t", String(Date.now()));
  if (options?.endTimeMs != null && Number.isFinite(options.endTimeMs)) {
    url.searchParams.set("endTime", String(options.endTimeMs));
  }
  const res = await fetch(url.toString());
  const json = await res.json();
  const data = json?.success ? json.data : null;
  if (!Array.isArray(data)) return [];
  return data.map((c: unknown) => parseKline(c as [number, string, string, string, string]));
}

type Props = {
  targetPrice?: number | null;
  /** 초기 선택 시간봉 (페이지 시장과 맞추려면 전달) */
  defaultInterval?: ChartInterval;
  className?: string;
};

export function BtcChart({ targetPrice, defaultInterval = "1m", className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ReturnType<ReturnType<typeof createChart>["addSeries"]> | null>(null);
  const dataRef = useRef<CandlestickData[]>([]);
  const loadingMoreRef = useRef(false);
  const intervalRef = useRef<ChartInterval>(defaultInterval);
  const [chartInterval, setChartInterval] = useState<ChartInterval>(defaultInterval);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  intervalRef.current = chartInterval;

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
        rightOffset: 12,
        rightOffsetPixels: 40,
      },
      rightPriceScale: {
        borderColor: "rgba(197, 203, 206, 0.2)",
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
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

    const handleVisibleRangeChange = () => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      const current = dataRef.current;
      if (!chart || !series || current.length === 0 || loadingMoreRef.current) return;
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!range || range.from >= LOAD_MORE_THRESHOLD) return;

      loadingMoreRef.current = true;
      const oldestMs = current[0].time * 1000 - 1;
      fetchBtcKlines(intervalRef.current, { endTimeMs: oldestMs })
        .then((older) => {
          if (!seriesRef.current || !chartRef.current) return;
          const existingFirst = current[0].time;
          const prepend = older.filter((c) => c.time < existingFirst);
          if (prepend.length === 0) {
            loadingMoreRef.current = false;
            return;
          }
          const merged = [...prepend, ...current];
          dataRef.current = merged;
          seriesRef.current!.setData(merged);
          chartRef.current!.timeScale().setVisibleLogicalRange({
            from: range.from + prepend.length,
            to: range.to + prepend.length,
          });
        })
        .finally(() => {
          loadingMoreRef.current = false;
        });
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
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

    const loadData = () => {
      fetchBtcKlines(chartInterval)
        .then((data) => {
          if (cancelled || !seriesRef.current || !chartRef.current || data.length === 0) return;
          dataRef.current = data;
          seriesRef.current.setData(data);
          const len = data.length;
          const visible = Math.min(DEFAULT_VISIBLE_BARS, len);
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: len - visible,
            to: len - 1,
          });
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
    const id = setInterval(loadData, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [chartInterval]);

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
      <div className="mb-2 flex flex-wrap gap-1">
        {INTERVAL_ORDER.map((iv) => (
          <button
            key={iv}
            type="button"
            onClick={() => setChartInterval(iv)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              chartInterval === iv
                ? "border-amber-500 bg-amber-500/20 text-amber-500"
                : "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {INTERVAL_LABELS[iv]}
          </button>
        ))}
      </div>
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
