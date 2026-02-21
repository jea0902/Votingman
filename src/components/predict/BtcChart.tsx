"use client";

/**
 * Lightweight Charts – 비트코인 실시간 차트
 * - 바이낸스 WebSocket 연결 (틱 단위 실시간 캔들)
 * - 초기 데이터는 REST API로 로드 후 WebSocket으로 실시간 업데이트
 * - 시간봉 전환 시 WebSocket 재연결
 * - 목표가 항상 뷰 범위 포함
 * - limit=1000 중복 요청 차단
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

const INTERVAL_ORDER: ChartInterval[] = ["1m", "15m", "1h", "4h", "1d"];
const INTERVAL_LABELS: Record<ChartInterval, string> = {
  "1m": "1분", "15m": "15분", "1h": "1시간", "4h": "4시간", "1d": "1일",
};
const CHART_LIMIT: Record<ChartInterval, number> = {
  "1m": 1000, "15m": 1000, "1h": 500, "4h": 400, "1d": 365,
};
const VISIBLE_BARS: Record<ChartInterval, number> = {
  "1m": 60, "15m": 48, "1h": 48, "4h": 42, "1d": 60,
};
const INITIAL_LOAD_LIMIT = 80;
const LOAD_MORE_THRESHOLD = 40;

// 바이낸스 WebSocket interval 매핑
const WS_INTERVAL: Record<ChartInterval, string> = {
  "1m": "1m", "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d",
};

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
  candleUp:     "#26a69a",
  candleDown:   "#ef5350",
  targetLine:   "#f59e0b",
  glowBlue:     "rgba(37,99,235,0.5)",
  glowCyan:     "rgba(96,165,250,0.35)",
  bgBtnActive:  "rgba(37,99,235,0.2)",
};

type CandlestickData = {
  time: UTCTimestamp;
  open: number; high: number; low: number; close: number;
};

function parseKline(candle: unknown[]): CandlestickData {
  const [openTime, open, high, low, close] = candle as [number, string, string, string, string];
  return {
    time:  Math.floor(openTime / 1000) as UTCTimestamp,
    open:  parseFloat(open),  high: parseFloat(high),
    low:   parseFloat(low),   close: parseFloat(close),
  };
}

async function fetchBtcKlines(
  interval: ChartInterval,
  options?: { endTimeMs?: number; limit?: number }
): Promise<CandlestickData[]> {
  const limit =
    options?.limit ?? (options?.endTimeMs != null ? CHART_LIMIT[interval] : INITIAL_LOAD_LIMIT);
  const url = new URL("https://api.binance.com/api/v3/klines");
  url.searchParams.set("symbol", "BTCUSDT");
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));
  if (options?.endTimeMs != null && Number.isFinite(options.endTimeMs)) {
    url.searchParams.set("endTime", String(options.endTimeMs));
  }
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(parseKline);
}

type Props = {
  targetPrice?: number | null;
  defaultInterval?: ChartInterval;
  className?: string;
};

export function BtcChart({ targetPrice, defaultInterval = "1m", className }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const chartRef       = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef      = useRef<ReturnType<ReturnType<typeof createChart>["addSeries"]> | null>(null);
  const dataRef        = useRef<CandlestickData[]>([]);
  const loadingMoreRef = useRef(false);
  const intervalRef    = useRef<ChartInterval>(defaultInterval);
  const unsubRangeRef  = useRef<(() => void) | null>(null);
  const wsRef          = useRef<WebSocket | null>(null);

  const [chartInterval, setChartInterval] = useState<ChartInterval>(defaultInterval);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [wsStatus, setWsStatus]           = useState<"connecting" | "connected" | "disconnected">("connecting");

  intervalRef.current = chartInterval;

  // ── 차트 인스턴스 생성 (마운트 1회) ──
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: THEME.bgCard },
        textColor:  THEME.textPrimary,
        fontSize:   11,
        fontFamily: "'Inter', 'Noto Sans KR', sans-serif",
      },
      grid: {
        vertLines: { color: THEME.gridLine },
        horzLines: { color: THEME.gridLine },
      },
      width:  containerRef.current.clientWidth,
      height: 440,
      timeScale: {
        timeVisible:    true,
        secondsVisible: false,
        borderColor:    THEME.borderCard,
        minBarSpacing:  2,
        barSpacing:     8,
        rightOffset:    10,
      },
      rightPriceScale: {
        borderColor:  THEME.borderCard,
        textColor:    THEME.textPrimary,
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: THEME.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: THEME.labelBg },
        horzLine: { color: THEME.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: THEME.labelBg },
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: THEME.candleUp,       downColor: THEME.candleDown,
      borderUpColor: THEME.candleUp, borderDownColor: THEME.candleDown,
      wickUpColor: THEME.candleUp,   wickDownColor: THEME.candleDown,
      lastValueVisible: false,       priceLineVisible: false,
    });
    seriesRef.current = series;

    if (targetPrice != null && targetPrice > 0) {
      series.createPriceLine({
        price: targetPrice, color: THEME.targetLine,
        lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: "목표가",
      });
    }

    const handleResize = () => {
      if (containerRef.current && chartRef.current)
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      unsubRangeRef.current?.();
      unsubRangeRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
      window.removeEventListener("resize", handleResize);
      seriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [targetPrice]);

  // ── 시간봉 변경 시: REST로 초기 데이터 로드 → WebSocket 연결 ──
  useEffect(() => {
    let cancelled = false;

    // 기존 구독/WebSocket 해제
    unsubRangeRef.current?.();
    unsubRangeRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;

    setLoading(true);
    setError(null);
    setWsStatus("connecting");

    // ① REST API로 초기 캔들 로드
    fetchBtcKlines(chartInterval)
      .then((data) => {
        if (cancelled || !seriesRef.current || !chartRef.current || data.length === 0) return;

        dataRef.current = data;
        seriesRef.current.setData(data);

        const len     = data.length;
        const visible = Math.min(VISIBLE_BARS[chartInterval], len);

        // 목표가 포함한 가격 범위 강제 적용
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
          to:   len + 3,
        });

        // ② range 구독 등록 (과거 스크롤 시 추가 로드)
        const handleVisibleRangeChange = () => {
          const c = chartRef.current;
          const s = seriesRef.current;
          const current = dataRef.current;
          if (!c || !s || current.length === 0 || loadingMoreRef.current) return;
          const range = c.timeScale().getVisibleLogicalRange();
          if (!range || range.from >= LOAD_MORE_THRESHOLD) return;

          loadingMoreRef.current = true;
          const oldestMs = current[0].time * 1000 - 1;
          fetchBtcKlines(intervalRef.current, { endTimeMs: oldestMs })
            .then((older) => {
              if (!seriesRef.current || !chartRef.current) return;
              const existingFirst = current[0].time;
              const prepend = older.filter((c) => c.time < existingFirst);
              if (prepend.length === 0) { loadingMoreRef.current = false; return; }
              const merged = [...prepend, ...current];
              dataRef.current = merged;
              seriesRef.current.setData(merged);
              chartRef.current.timeScale().setVisibleLogicalRange({
                from: range.from + prepend.length,
                to:   range.to   + prepend.length,
              });
            })
            .finally(() => { loadingMoreRef.current = false; });
        };

        chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
        unsubRangeRef.current = () =>
          chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

        setLoading(false);

        // ③ WebSocket 연결 (초기 로드 완료 후)
        if (cancelled) return;
        const wsUrl = `wss://stream.binance.com:9443/ws/btcusdt@kline_${WS_INTERVAL[chartInterval]}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!cancelled) setWsStatus("connected");
        };

        ws.onmessage = (event) => {
          if (cancelled || !seriesRef.current) return;
          try {
            const msg = JSON.parse(event.data as string);
            const k = msg?.k;
            if (!k) return;

            const candle: CandlestickData = {
              time:  Math.floor(k.t / 1000) as UTCTimestamp,
              open:  parseFloat(k.o),
              high:  parseFloat(k.h),
              low:   parseFloat(k.l),
              close: parseFloat(k.c),
            };

            // 현재 캔들 업데이트 or 새 캔들 추가
            seriesRef.current.update(candle);

            const current = dataRef.current;
            if (current.length > 0 && current[current.length - 1].time === candle.time) {
              // 현재 캔들 갱신
              current[current.length - 1] = candle;
            } else if (current.length === 0 || candle.time > current[current.length - 1].time) {
              // 새 캔들 추가
              current.push(candle);
            }
          } catch {
            // 파싱 오류 무시
          }
        };

        ws.onerror = () => {
          if (!cancelled) setWsStatus("disconnected");
        };

        ws.onclose = () => {
          if (!cancelled) setWsStatus("disconnected");
        };
      })
      .catch(() => {
        if (!cancelled) {
          setError("차트 데이터를 불러올 수 없습니다.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [chartInterval, targetPrice]);

  if (error) {
    return (
      <div
        className={cn("flex h-[500px] items-center justify-center rounded-2xl", className)}
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
        border:     `1px solid ${THEME.borderCard}`,
        boxShadow:  "0 0 0 1px rgba(37,99,235,0.08), 0 8px 40px rgba(4,7,18,0.7)",
      }}
    >
      {/* 상단 블루 글로우 라인 */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-10"
        style={{
          height:     "1px",
          background: `linear-gradient(90deg, transparent, ${THEME.glowBlue}, ${THEME.glowCyan}, ${THEME.glowBlue}, transparent)`,
        }}
      />

      {/* 버튼 바 */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: THEME.bgBtnBar, borderBottom: `1px solid ${THEME.borderCard}` }}
      >
        {/* 시간봉 버튼 */}
        <div className="flex items-center gap-1">
          {INTERVAL_ORDER.map((iv) => {
            const isActive = chartInterval === iv;
            return (
              <button
                key={iv}
                type="button"
                onClick={() => setChartInterval(iv)}
                style={{
                  background:   isActive ? THEME.bgBtnActive : "transparent",
                  border:       `1px solid ${isActive ? THEME.borderActive : "transparent"}`,
                  color:        isActive ? THEME.textActive : THEME.textMuted,
                  borderRadius: "7px",
                  padding:      "4px 14px",
                  fontSize:     "12px",
                  fontWeight:   isActive ? 600 : 400,
                  cursor:       "pointer",
                  transition:   "all 0.15s",
                  fontFamily:   "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = THEME.textMuted;
                }}
              >
                {INTERVAL_LABELS[iv]}
              </button>
            );
          })}
        </div>

        {/* WebSocket 연결 상태 표시 */}
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: wsStatus === "connected"
                ? "#34d399"
                : wsStatus === "connecting"
                  ? "#f59e0b"
                  : "#ef4444",
              boxShadow: wsStatus === "connected"
                ? "0 0 0 3px rgba(52,211,153,0.2)"
                : "none",
              animation: wsStatus === "connected" ? "pulse 2s infinite" : "none",
            }}
          />
          <span style={{ fontSize: "11px", color: THEME.textMuted }}>
            {wsStatus === "connected" ? "실시간" : wsStatus === "connecting" ? "연결 중" : "연결 끊김"}
          </span>
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
            차트 불러오는 중…
          </span>
        </div>
      )}

      {/* 차트 */}
      <div ref={containerRef} />

      {/* 하단 페이드 */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
        style={{
          height:     "24px",
          background: `linear-gradient(to bottom, transparent, ${THEME.bgCard})`,
        }}
      />
    </div>
  );
}