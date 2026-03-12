"use client";

/**
 * AI 예측 일관성 지수 차트
 *
 * - 그래프 탭: 승률 | 수익률
 * - 가로축: 일별/주별/월별/연별 기간
 * - 세로축: 각 모델의 지표 %
 * - ChatGPT, Gemini, Claude, Grok 4개 모델 라인
 * - 데이터 쌓이면 주별/월별/연별 전환 가능 (더미데이터)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  LineSeries,
  type UTCTimestamp,
} from "lightweight-charts";
import { cn } from "@/lib/utils";

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
  glowBlue: "rgba(37,99,235,0.5)",
  bgBtnActive: "rgba(37,99,235,0.2)",
  chatgpt: "#10b981",
  gemini: "#3b82f6",
  claude: "#f59e0b",
  grok: "#94a3b8",
};

type Period = "daily" | "weekly" | "monthly" | "yearly";
type ChartMetric = "winRate" | "profit";

const PERIOD_ORDER: Period[] = ["daily", "weekly", "monthly", "yearly"];
const PERIOD_LABELS: Record<Period, string> = {
  daily: "일별",
  weekly: "주별",
  monthly: "월별",
  yearly: "연별",
};

const CHART_METRIC_ORDER: ChartMetric[] = ["winRate", "profit"];
const CHART_METRIC_LABELS: Record<ChartMetric, string> = {
  winRate: "승률",
  profit: "수익률",
};

const MODEL_IDS = ["chatgpt", "gemini", "claude", "grok"] as const;
const MODEL_NAMES: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  claude: "Claude",
  grok: "Grok",
};

function getStepParams(period: Period) {
  switch (period) {
    case "daily": return { count: 14, stepMs: 24 * 60 * 60 * 1000 };
    case "weekly": return { count: 8, stepMs: 7 * 24 * 60 * 60 * 1000 };
    case "monthly": return { count: 6, stepMs: 30 * 24 * 60 * 60 * 1000 };
    case "yearly": return { count: 3, stepMs: 365 * 24 * 60 * 60 * 1000 };
    default: return { count: 14, stepMs: 24 * 60 * 60 * 1000 };
  }
}

/** 승률 더미 데이터 */
function generateWinRateData(period: Period): Record<string, { time: UTCTimestamp; value: number }[]> {
  const now = new Date();
  const { count, stepMs } = getStepParams(period);
  const baseRates = { chatgpt: 62, gemini: 59, claude: 57, grok: 54 };
  const result: Record<string, { time: UTCTimestamp; value: number }[]> = {
    chatgpt: [], gemini: [], claude: [], grok: [],
  };

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * stepMs);
    const time = (d.getTime() / 1000) as UTCTimestamp;
    for (const modelId of MODEL_IDS) {
      const base = baseRates[modelId];
      const variation = Math.sin(i * 0.5) * 3 + Math.sin(i * 0.3 + modelId.length) * 2;
      const value = Math.max(40, Math.min(80, base + variation));
      result[modelId].push({ time, value: Math.round(value * 10) / 10 });
    }
  }
  return result;
}

/** 수익률 더미 데이터 */
function generateProfitData(period: Period): Record<string, { time: UTCTimestamp; value: number }[]> {
  const now = new Date();
  const { count, stepMs } = getStepParams(period);
  const baseRates = { chatgpt: 8, gemini: 5, claude: 3, grok: 1 };
  const result: Record<string, { time: UTCTimestamp; value: number }[]> = {
    chatgpt: [], gemini: [], claude: [], grok: [],
  };

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * stepMs);
    const time = (d.getTime() / 1000) as UTCTimestamp;
    for (const modelId of MODEL_IDS) {
      const base = baseRates[modelId];
      const variation = Math.sin(i * 0.4) * 4 + Math.sin(i * 0.2 + modelId.length) * 3;
      const value = Math.max(-15, Math.min(25, base + variation));
      result[modelId].push({ time, value: Math.round(value * 10) / 10 });
    }
  }
  return result;
}

interface Props {
  className?: string;
}

export function AIPredictionConsistencyChart({ className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRefs = useRef<Record<string, { setData: (data: { time: UTCTimestamp; value: number }[]) => void } | null>>({
    chatgpt: null,
    gemini: null,
    claude: null,
    grok: null,
  });

  const [period, setPeriod] = useState<Period>("daily");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("winRate");
  const [loading, setLoading] = useState(false);

  // 차트 인스턴스 및 4개 라인 시리즈 생성
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
      height: 280,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: THEME.borderCard,
        rightOffset: 10,
      },
      rightPriceScale: {
        visible: true,
        borderColor: THEME.borderCard,
        scaleMargins: { top: 0.1, bottom: 0.1 },
        entireTextOnly: true,
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

    const colors = [THEME.chatgpt, THEME.gemini, THEME.claude, THEME.grok];
    MODEL_IDS.forEach((id, idx) => {
      const series = chart.addSeries(LineSeries, {
        color: colors[idx],
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: true,
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${price.toFixed(1)}%`,
        },
      });
      seriesRefs.current[id] = series;
    });

    const handleResize = () => {
      if (containerRef.current && chartRef.current)
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      MODEL_IDS.forEach((id) => {
        seriesRefs.current[id] = null;
      });
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, []);

  const fetchData = useCallback((p: Period, metric: ChartMetric) => {
    setLoading(true);
    const data = metric === "winRate" ? generateWinRateData(p) : generateProfitData(p);

    MODEL_IDS.forEach((id) => {
      const series = seriesRefs.current[id];
      if (series) series.setData(data[id]);
    });

    chartRef.current?.timeScale().fitContent();
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(period, chartMetric), 100);
    return () => clearTimeout(timer);
  }, [period, chartMetric, fetchData]);

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl", className)}
      style={{
        background: THEME.bgCard,
        border: `1px solid ${THEME.borderCard}`,
        boxShadow: "0 0 0 1px rgba(37,99,235,0.08), 0 8px 40px rgba(4,7,18,0.7)",
      }}
    >
      {/* 헤더: 그래프 탭 + 기간 선택 */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
        style={{ background: THEME.bgBtnBar, borderBottom: `1px solid ${THEME.borderCard}` }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#ffffff" }}>
            AI 예측 일관성 지수
          </span>
          <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
          {CHART_METRIC_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setChartMetric(m)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                chartMetric === m ? "text-white" : "text-muted-foreground hover:text-foreground"
              )}
              style={
                chartMetric === m
                  ? { background: THEME.bgBtnActive, color: THEME.textActive }
                  : undefined
              }
            >
              {CHART_METRIC_LABELS[m]}
            </button>
          ))}
        </div>
        </div>

        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
          {PERIOD_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                period === p
                  ? "text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
              style={
                period === p
                  ? { background: THEME.bgBtnActive, color: THEME.textActive }
                  : undefined
              }
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div
        className="flex flex-wrap items-center justify-center gap-4 px-4 py-2"
        style={{ borderBottom: `1px solid ${THEME.borderCard}` }}
      >
        {MODEL_IDS.map((id, idx) => {
          const colors = [THEME.chatgpt, THEME.gemini, THEME.claude, THEME.grok];
          return (
            <span key={id} className="flex items-center gap-1.5 text-xs" style={{ color: THEME.textPrimary }}>
              <span
                style={{
                  width: 10,
                  height: 2,
                  borderRadius: 1,
                  background: colors[idx],
                }}
              />
              {MODEL_NAMES[id]}
            </span>
          );
        })}
      </div>

      {/* 차트 영역 */}
      <div ref={containerRef} className="relative" />
      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(15,22,41,0.6)" }}
        >
          <span style={{ fontSize: "12px", color: THEME.textMuted }}>로딩 중...</span>
        </div>
      )}
    </div>
  );
}
