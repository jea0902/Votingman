"use client";

/**
 * 일별 활성 유저·투표 수 선 그래프 (SVG 기반, 의존성 없음)
 */
import { useMemo } from "react";

export interface DailyStatRow {
  stat_date: string;
  active_user_count: number;
  vote_count: number;
}

interface DailyStatsChartProps {
  rows: DailyStatRow[];
  className?: string;
}

const CHART_HEIGHT = 180;
const PADDING = { top: 12, right: 8, bottom: 28, left: 36 };

function buildPath(
  points: { x: number; y: number }[],
  width: number,
  height: number
): string {
  if (points.length === 0) return "";
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const scaleX = (v: number) => PADDING.left + ((v - minX) / rangeX) * (width - PADDING.left - PADDING.right);
  const scaleY = (v: number) => height - PADDING.bottom - ((v - minY) / rangeY) * (height - PADDING.top - PADDING.bottom);

  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`)
    .join(" ");
}

export function DailyStatsChart({ rows, className = "" }: DailyStatsChartProps) {
  const { pathActive, pathVote, labels, maxActive, maxVote } = useMemo(() => {
    if (rows.length === 0) {
      return { pathActive: "", pathVote: "", labels: [] as string[], maxActive: 0, maxVote: 0 };
    }

    const labels = rows.map((r) => r.stat_date.slice(5));
    const activePoints = rows.map((r, i) => ({
      x: i,
      y: r.active_user_count,
    }));
    const votePoints = rows.map((r, i) => ({
      x: i,
      y: r.vote_count,
    }));

    const width = 400;
    const height = CHART_HEIGHT;

    return {
      pathActive: buildPath(activePoints, width, height),
      pathVote: buildPath(votePoints, width, height),
      labels,
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className={`rounded border border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground ${className}`}>
        집계 데이터가 없습니다. 크론(매일 23:59 KST) 실행 후 표시됩니다.
      </div>
    );
  }

  const width = 400;
  const height = CHART_HEIGHT;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[400px] w-full h-[180px]"
        preserveAspectRatio="xMinYMid meet"
      >
        <defs>
          <linearGradient id="gradActive" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradVote" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="hsl(142 76% 36%)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(142 76% 36%)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 활성 유저 선 */}
        <path
          d={pathActive}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`${pathActive} L ${width - PADDING.right} ${height - PADDING.bottom} L ${PADDING.left} ${height - PADDING.bottom} Z`}
          fill="url(#gradActive)"
        />

        {/* 투표 수 선 */}
        <path
          d={pathVote}
          fill="none"
          stroke="hsl(142 76% 36%)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`${pathVote} L ${width - PADDING.right} ${height - PADDING.bottom} L ${PADDING.left} ${height - PADDING.bottom} Z`}
          fill="url(#gradVote)"
        />

        {/* X축 라벨 */}
        {labels.map((label, i) => {
          const step = labels.length > 10 ? Math.ceil(labels.length / 8) : 1;
          if (i % step !== 0 && i !== labels.length - 1) return null;
          const x = PADDING.left + (i / (labels.length - 1 || 1)) * (width - PADDING.left - PADDING.right);
          return (
            <text
              key={i}
              x={x}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {label}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-primary" />
          활성 유저 수
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-green-600" />
          투표 수
        </span>
      </div>
    </div>
  );
}
