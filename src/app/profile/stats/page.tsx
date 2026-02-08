"use client";

/**
 * 전적 및 승률 조회 페이지
 *
 * 설계 의도:
 * - 양옆 10% 여백, 80% 콘텐츠 영역 (큰 파일 레이아웃)
 * - 왼쪽 상단: UserInfoCard
 * - 아래: 정산 이력 테이블 (예측 대상일, 정산 날짜, market, 배팅 코인, 시가, 종가, 가격변동률, 승리 여부, payout, 총 보유 코인, 누적 승률)
 */

import { useState, useEffect } from "react";
import { UserInfoCard } from "@/components/home";

type VoteHistoryRow = {
  poll_date: string;
  settled_at: string;
  market: string;
  market_label: string;
  bet_amount: number;
  price_open: number | null;
  price_close: number | null;
  change_pct: number | null;
  result: "win" | "loss" | "refund";
  payout_amount: number;
  cumulative_win_rate_pct: number;
  balance_after: number;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ProfileStatsPage() {
  const [rows, setRows] = useState<VoteHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    const qs = params.toString();
    const url = `/api/profile/vote-history${qs ? `?${qs}` : ""}`;

    fetch(url, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && json?.data) {
          setRows(Array.isArray(json.data.rows) ? json.data.rows : []);
        } else {
          setError(json?.error?.message ?? "데이터를 불러오는데 실패했습니다.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("네트워크 오류가 발생했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  return (
    <div className="min-h-screen py-8">
      {/* 양옆 10% 여백, 80% 콘텐츠 */}
      <div className="mx-auto w-[80%] max-w-6xl">
        <div className="rounded-xl border border-border bg-card px-6 py-8 shadow-lg sm:px-8 sm:py-10">
          <h1 className="mb-6 text-xl font-bold text-foreground sm:text-2xl">
            전적 및 승률 조회
          </h1>

          {/* 왼쪽 상단: UserInfoCard */}
          <div className="mb-8 max-w-sm">
            <UserInfoCard />
          </div>

          {/* 아래: 정산 이력 테이블 */}
          <section aria-label="정산 이력">
            <h2 className="mb-3 text-base font-semibold text-foreground">
              정산 이력
            </h2>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>시작일</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>종료일</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="rounded border border-border bg-muted/50 px-2 py-1 text-sm hover:bg-muted"
              >
                초기화
              </button>
            </div>

            {loading ? (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                불러오는 중…
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-8 text-center text-sm text-destructive">
                {error}
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                아직 정산된 투표 이력이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 font-medium">예측 대상일</th>
                      <th className="px-3 py-2 font-medium">정산 날짜</th>
                      <th className="px-3 py-2 font-medium">시장</th>
                      <th className="px-3 py-2 font-medium text-right">배팅 코인</th>
                      <th className="px-3 py-2 font-medium text-right">시가</th>
                      <th className="px-3 py-2 font-medium text-right">종가</th>
                      <th className="px-3 py-2 font-medium text-right">가격변동률</th>
                      <th className="px-3 py-2 font-medium text-center">승리 여부</th>
                      <th className="px-3 py-2 font-medium text-right">payout</th>
                      <th className="px-3 py-2 font-medium text-right">총 보유 코인</th>
                      <th className="px-3 py-2 font-medium text-right">누적 승률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={`${r.poll_date}-${r.market}-${i}`}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2">{formatDate(r.poll_date)}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDateTime(r.settled_at)}
                        </td>
                        <td className="px-3 py-2">{r.market_label}</td>
                        <td className="px-3 py-2 text-right">
                          {r.bet_amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.price_open != null ? r.price_open.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.price_close != null ? r.price_close.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.change_pct != null ? `${r.change_pct.toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={
                              r.result === "win"
                                ? "font-medium text-[#3b82f6]"
                                : r.result === "loss"
                                  ? "font-medium text-rose-500"
                                  : "text-muted-foreground"
                            }
                          >
                            {r.result === "win" ? "승" : r.result === "loss" ? "패" : "무효"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.payout_amount > 0
                            ? `+${r.payout_amount.toLocaleString()}`
                            : r.payout_amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {r.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.cumulative_win_rate_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
