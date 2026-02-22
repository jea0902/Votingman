"use client";

/**
 * 미결제약정(OI) 히스토리 차트
 *
 * - Lightweight Charts 기반 (BtcChart.tsx와 동일한 스타일)
 * - Supabase DB에서 기간별 데이터 조회
 * - 기간 선택: 1개월 / 3개월 / 6개월 / 1년 / 전체
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  AreaSeries,
  type UTCTimestamp,
} from "lightweight-charts";
import { cn } from "@/lib/utils";

// BtcChart와 동일한 테마
const THEME = {
  bgCard:       "#0f1629",
  bgBtnBar:     "#0b1020",
  borderCard:   "rgba(255,255,255,0.08)",
  borderActive: "#2563eb",
  gridLine:     "rgba(255,255,255,0.04)",
  textPrimary:  "rgba(255,255,255,0.55)",
  textMuted:    "rgba(255,255,255,0.28)",
  textActive:   "#60a5fa",
  crosshair:    "rgba(96,165,250,0.4)",
  labelBg:      "#1a3568",
  glowBlue:     "rgba(37,99,235,0.5)",
  glowCyan:     "rgba(96,165,250,0.35)",
  bgBtnActive:  "rgba(37,99,235,0.2)",
  areaLine:     "#10b981",   // emerald-500
  areaTop:      "rgba(16,185,129,0.3)",
  areaBottom:   "rgba(16,185,129,0.0)",
};

type Period = "1m" | "3m" | "6m" | "1y" | "all";

const PERIOD_ORDER: Period[] = ["1m", "3m", "6m", "1y", "all"];
const PERIOD_LABELS: Record<Period, string> = {
  "1m": "1개월",
  "3m": "3개월",
  "6m": "6개월",
  "1y": "1년",
  "all": "전체",
};

interface OIDataPoint {
  date: string;
  oi_value: number;
  oi_coins: number;
}

function formatOIValue(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

interface Props {
  className?: string;
}

export function OpenInterestChart({ className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<any>(null);

  const [period, setPeriod] = useState<Period>("3m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestOI, setLatestOI] = useState<number | null>(null);
  const [changeRate, setChangeRate] = useState<number | null>(null);

  // 차트 인스턴스 생성 (마운트 1회)
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
      height: 240,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: THEME.borderCard,
        rightOffset: 10,
      },
      rightPriceScale: {
        borderColor: THEME.borderCard,
        textColor: THEME.textPrimary,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: THEME.crosshair, width: 1, style: LineStyle.Dashed,
          labelBackgroundColor: THEME.labelBg,
        },
        horzLine: {
          color: THEME.crosshair, width: 1, style: LineStyle.Dashed,
          labelBackgroundColor: THEME.labelBg,
        },
      },
    });

    chartRef.current = chart;

    // Area 시리즈 추가 (BtcChart의 addSeries 방식과 동일)
    const series = chart.addSeries(AreaSeries, {
      lineColor: THEME.areaLine,
      topColor: THEME.areaTop,
      bottomColor: THEME.areaBottom,
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: {
        type: "custom",
        formatter: (price: number) => formatOIValue(price),
      },
    });
    seriesRef.current = series;

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
  }, []);

  // 기간 변경 시 데이터 로드
  const fetchData = useCallback(async (p: Period) => {
    if (!seriesRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/market-sentiment/oi-chart?period=${p}`);
      if (!res.ok) throw new Error("데이터 로드 실패");
      const json = await res.json();
      const raw: OIDataPoint[] = json.data ?? [];

      if (raw.length === 0) {
        setError("데이터가 없습니다.");
        setLoading(false);
        return;
      }

      // Lightweight Charts 형식으로 변환
      const chartData = raw.map((d) => ({
        time: (new Date(d.date).getTime() / 1000) as UTCTimestamp,
        value: d.oi_value,
      }));

      seriesRef.current.setData(chartData);
      chartRef.current?.timeScale().fitContent();

      // 최신값 & 전일 대비 변화율
      const latest = raw[raw.length - 1];
      const prev = raw[raw.length - 2];
      setLatestOI(latest.oi_value);
      if (prev) {
        setChangeRate(((latest.oi_value - prev.oi_value) / prev.oi_value) * 100);
      }
    } catch {
      setError("OI 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 차트 인스턴스가 준비된 후 데이터 로드
    const timer = setTimeout(() => fetchData(period), 100);
    return () => clearTimeout(timer);
  }, [period, fetchData]);

  if (error && !loading) {
    return (
      <div
        className={cn("flex h-[320px] items-center justify-center rounded-2xl", className)}
        style={{ background: THEME.bgCard, border: `1px solid ${THEME.borderCard}` }}
      >
        <p className="text-sm" style={{ color: THEME.textMuted }}>{error}</p>
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
      {/* 상단 블루 글로우 라인 */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-10"
        style={{
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${THEME.glowBlue}, ${THEME.glowCyan}, ${THEME.glowBlue}, transparent)`,
        }}
      />

      {/* 헤더 버튼 바 */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: THEME.bgBtnBar, borderBottom: `1px solid ${THEME.borderCard}` }}
      >
        {/* 왼쪽: 타이틀 + 현재값 */}
        <div className="flex items-center gap-3">
          <span style={{ fontSize: "12px", fontWeight: 600, color: THEME.textPrimary }}>
            미결제약정 (OI)
          </span>
          {latestOI !== null && (
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#10b981", fontVariantNumeric: "tabular-nums" }}>
              {formatOIValue(latestOI)}
            </span>
          )}
          {changeRate !== null && (
            <span style={{
              fontSize: "11px",
              fontWeight: 600,
              color: changeRate >= 0 ? "#34d399" : "#f87171",
              fontVariantNumeric: "tabular-nums",
            }}>
              {changeRate >= 0 ? "▲" : "▼"} {Math.abs(changeRate).toFixed(2)}%
            </span>
          )}
        </div>

        {/* 오른쪽: 기간 선택 */}
        <div className="flex items-center gap-1">
          {PERIOD_ORDER.map((p) => {
            const isActive = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                style={{
                  background: isActive ? THEME.bgBtnActive : "transparent",
                  border: `1px solid ${isActive ? THEME.borderActive : "transparent"}`,
                  color: isActive ? THEME.textActive : THEME.textMuted,
                  borderRadius: "7px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = THEME.textMuted;
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 로딩 오버레이 */}
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
            데이터 불러오는 중…
          </span>
        </div>
      )}

      {/* 차트 영역 */}
      <div ref={containerRef} />

      {/* 하단 설명 */}
      <div
        className="px-4 py-2"
        style={{ borderTop: `1px solid ${THEME.borderCard}` }}
      >
        <p style={{ fontSize: "10px", color: THEME.textMuted }}>
          * OI 증가 + 가격 상승 → 강세 신호 &nbsp;/&nbsp; OI 증가 + 가격 하락 → 약세 신호 &nbsp;·&nbsp; 바이낸스 공식 데이터
        </p>
      </div>

      {/* 하단 페이드 */}
      <div
        className="pointer-events-none absolute bottom-8 left-0 right-0 z-10"
        style={{
          height: "20px",
          background: `linear-gradient(to bottom, transparent, ${THEME.bgCard})`,
        }}
      />
    </div>
  );
}