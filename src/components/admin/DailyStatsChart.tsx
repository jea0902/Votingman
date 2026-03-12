"use client";

/**
 * 일별 활성 유저·투표 수 차트
 * - 일반적인 SVG 선 그래프
 * - 기간 선택, 두 개의 선(활성 유저 / 투표 수)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DailyStatRow {
  stat_date: string;
  active_user_count: number;
  vote_count: number;
}

type Period = "1m" | "3m" | "6m" | "1y" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "1m", label: "1개월" },
  { id: "3m", label: "3개월" },
  { id: "6m", label: "6개월" },
  { id: "1y", label: "1년" },
  { id: "all", label: "전체" },
];

const W = 600;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 32, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function buildLinePath(
  values: number[],
  min: number,
  max: number,
  baseY: number
): string {
  if (values.length === 0) return "";
  const range = max - min || 1;
  const step = values.length > 1 ? PLOT_W / (values.length - 1) : 0;
  const scaleY = (v: number) => baseY - ((v - min) / range) * PLOT_H;
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${PAD.left + i * step} ${scaleY(v)}`)
    .join(" ");
}

function SimpleLineChart({
  labels,
  values,
  color,
  unit,
}: {
  labels: string[];
  values: number[];
  color: string;
  unit: string;
}) {
  const { path, ticks, min, max } = useMemo(() => {
    if (values.length === 0) return { path: "", ticks: [0, 5, 10], min: 0, max: 10 };
    const minV = Math.min(...values, 0);
    const maxV = Math.max(...values, 1);
    const range = maxV - minV || 1;
    const tickStep = range <= 5 ? 1 : range <= 20 ? 2 : range <= 50 ? 5 : Math.ceil(range / 8);
    const tickMin = Math.floor(minV / tickStep) * tickStep;
    const tickMax = Math.ceil(maxV / tickStep) * tickStep;
    const ticks: number[] = [];
    for (let t = tickMin; t <= tickMax; t += tickStep) ticks.push(t);
    const minT = ticks[0] ?? 0;
    const maxT = ticks[ticks.length - 1] ?? 10;
    const baseY = PAD.top + PLOT_H;
    return {
      path: buildLinePath(values, minT, maxT, baseY),
      ticks,
      min: minT,
      max: maxT,
    };
  }, [values]);

  if (values.length === 0) return null;

  const step = values.length > 1 ? PLOT_W / (values.length - 1) : 0;

  return (
    <div className="mb-6 last:mb-0">
      <p className="mb-2 text-sm font-medium text-foreground" style={{ color }}>
        {unit}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-full" preserveAspectRatio="xMidYMid meet">
        {/* Y축 눈금선 */}
        {ticks.map((t, i) => {
          const y = PAD.top + PLOT_H - ((t - min) / (max - min)) * PLOT_H;
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + PLOT_W}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.15}
                strokeDasharray="4 2"
              />
              <text
                x={PAD.left - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {t}
              </text>
            </g>
          );
        })}
        {/* 선 */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* X축 라벨 */}
        {labels.map((l, i) => {
          if (labels.length > 12 && i % Math.ceil(labels.length / 8) !== 0 && i !== labels.length - 1)
            return null;
          const x = PAD.left + i * step;
          return (
            <text
              key={i}
              x={x}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {l}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function DailyStatsChart({ className }: { className?: string }) {
  const [period, setPeriod] = useState<Period>("3m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DailyStatRow[]>([]);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/daily-stats?period=${p}`, { credentials: "include" });
      if (!res.ok) throw new Error("데이터 로드 실패");
      const json = await res.json();
      const raw: DailyStatRow[] = json.data?.rows ?? [];
      setRows(raw);
      if (raw.length === 0) setError("집계 데이터가 없습니다. 크론(매일 23:59 KST) 실행 후 표시됩니다.");
    } catch {
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const labels = useMemo(() => rows.map((r) => r.stat_date.slice(5)), [rows]);
  const activeValues = useMemo(() => rows.map((r) => r.active_user_count), [rows]);
  const voteValues = useMemo(() => rows.map((r) => r.vote_count), [rows]);

  if (error && !loading) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] items-center justify-center rounded-lg border border-border bg-muted/30 p-6",
          className
        )}
      >
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">일별 성장</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p.id}
              variant={period === p.id ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          집계 데이터가 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[400px]">
            <SimpleLineChart
              labels={labels}
              values={activeValues}
              color="hsl(142 76% 36%)"
              unit="활성 유저 (명)"
            />
            <SimpleLineChart
              labels={labels}
              values={voteValues}
              color="hsl(221 83% 53%)"
              unit="투표 수 (건)"
            />
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        active_users_state 일별 집계 · 매일 KST 23:59 크론 실행
      </p>
    </div>
  );
}
