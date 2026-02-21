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
  /** 예측 대상일 표시용 (btc_1d일 때 KST 보정) */
  poll_date_display: string;
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
    <div className="min-h-screen py-6 sm:py-8">
      {/* 모바일: 넓은 너비, 데스크톱: 80% 콘텐츠 */}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-xl border border-border bg-card px-4 py-6 shadow-lg sm:px-8 sm:py-10">
          <h1 className="mb-6 text-xl font-bold text-foreground sm:text-2xl">
            전적 및 승률 조회
          </h1>

          <div className="mb-8 max-w-sm">
            <UserInfoCard />
          </div>

          <section aria-label="정산 이력">
            <h2 className="mb-3 text-base font-semibold text-foreground">
              정산 이력
            </h2>
            {/* 날짜 필터: 모바일 세로 배치 + 터치 영역 확대 */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <label className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-1.5">
                <span>시작일</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="min-h-[44px] rounded border border-border bg-background px-3 py-2.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-1.5">
                <span>종료일</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="min-h-[44px] rounded border border-border bg-background px-3 py-2.5 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="min-h-[44px] self-start rounded border border-border bg-muted/50 px-4 py-2.5 text-sm hover:bg-muted sm:self-center"
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
              <>
                {/* 모바일: 카드 뷰 (md 미만) */}
                <div className="space-y-3 md:hidden">
                  {rows.map((r, i) => (
                    <div
                      key={`${r.poll_date}-${r.market}-${i}`}
                      className="rounded-lg border border-border bg-muted/20 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                        <span className="text-xs text-muted-foreground">{formatDate(r.poll_date_display ?? r.poll_date)}</span>
                        <span
                          className={
                            r.result === "win"
                              ? "font-bold text-[#3b82f6]"
                              : r.result === "loss"
                                ? "font-bold text-rose-500"
                                : "font-medium text-muted-foreground"
                          }
                        >
                          {r.result === "win" ? "승" : r.result === "loss" ? "패" : "무효"}
                        </span>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        <dt className="text-muted-foreground">시장</dt>
                        <dd className="text-right font-medium">{r.market_label}</dd>
                        <dt className="text-muted-foreground">배팅 코인</dt>
                        <dd className="text-right tabular-nums">{r.bet_amount.toLocaleString()}</dd>
                        <dt className="text-muted-foreground">payout</dt>
                        <dd className="text-right tabular-nums">
                          {r.payout_amount > 0 ? `+${r.payout_amount.toLocaleString()}` : r.payout_amount.toLocaleString()}
                        </dd>
                        <dt className="text-muted-foreground">누적 승률</dt>
                        <dd className="text-right font-medium tabular-nums">{r.cumulative_win_rate_pct}%</dd>
                        <dt className="text-muted-foreground">정산 일시</dt>
                        <dd className="text-right text-muted-foreground">{formatDateTime(r.settled_at)}</dd>
                        <dt className="text-muted-foreground">시가</dt>
                        <dd className="text-right tabular-nums">
                          {r.price_open != null ? r.price_open.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                        </dd>
                        <dt className="text-muted-foreground">종가</dt>
                        <dd className="text-right tabular-nums">
                          {r.price_close != null ? r.price_close.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                        </dd>
                        <dt className="text-muted-foreground">가격변동률</dt>
                        <dd className="text-right tabular-nums">{r.change_pct != null ? `${r.change_pct.toFixed(2)}%` : "—"}</dd>
                        <dt className="text-muted-foreground">총 보유 코인</dt>
                        <dd className="text-right font-medium tabular-nums">
                          {r.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </dd>
                      </dl>
                    </div>
                  ))}
                </div>

                {/* 데스크톱: 테이블 (md 이상) + 말줄임·툴팁 */}
                <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
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
                      {rows.map((r, i) => {
                        const dateStr = formatDate(r.poll_date_display ?? r.poll_date);
                        const dateTimeStr = formatDateTime(r.settled_at);
                        return (
                          <tr
                            key={`${r.poll_date}-${r.market}-${i}`}
                            className="border-b border-border/60 last:border-0 hover:bg-muted/20"
                          >
                            <td className="max-w-[6rem] truncate px-3 py-2" title={dateStr}>{dateStr}</td>
                            <td className="max-w-[8rem] truncate px-3 py-2 text-muted-foreground" title={dateTimeStr}>{dateTimeStr}</td>
                            <td className="max-w-[7rem] truncate px-3 py-2" title={r.market_label}>{r.market_label}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.bet_amount.toLocaleString()}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                              {r.price_open != null ? r.price_open.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                              {r.price_close != null ? r.price_close.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
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
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                              {r.payout_amount > 0 ? `+${r.payout_amount.toLocaleString()}` : r.payout_amount.toLocaleString()}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                              {r.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.cumulative_win_rate_pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 hidden text-xs text-muted-foreground md:block">
                  말줄임(…)된 셀에 마우스를 올리면 전체 내용을 볼 수 있습니다.
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
