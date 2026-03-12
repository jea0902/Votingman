"use client";

import { useState, useEffect, useCallback } from "react";

type CronError = {
  job_name: string;
  error_code: string;
  error_message: string;
  created_at: string;
  context?: Record<string, unknown> | null;
};

type UnsettledPoll = {
  poll_id: string;
  market: string;
  candle_start_at: string;
  poll_date: string;
};

const JOBS = [
  { job_name: "btc-ohlc-daily", label: "BTC 1일봉" },
  { job_name: "btc-ohlc-4h", label: "BTC 4시간봉" },
  { job_name: "btc-ohlc-1h", label: "BTC 1시간봉" },
  { job_name: "btc-ohlc-15m", label: "BTC 15분봉" },
  { job_name: "btc-ohlc-5m", label: "BTC 5분봉" },
  { job_name: "eth-ohlc-daily", label: "ETH 1일봉" },
  { job_name: "eth-ohlc-4h", label: "ETH 4시간봉" },
  { job_name: "eth-ohlc-1h", label: "ETH 1시간봉" },
  { job_name: "eth-ohlc-15m", label: "ETH 15분봉" },
  { job_name: "eth-ohlc-5m", label: "ETH 5분봉" },
  { job_name: "xrp-ohlc-daily", label: "XRP 1일봉" },
  { job_name: "xrp-ohlc-4h", label: "XRP 4시간봉" },
  { job_name: "xrp-ohlc-1h", label: "XRP 1시간봉" },
  { job_name: "xrp-ohlc-15m", label: "XRP 15분봉" },
  { job_name: "xrp-ohlc-5m", label: "XRP 5분봉" },
];

export function CronStatusPanel() {
  const [errors, setErrors] = useState<CronError[]>([]);
  const [unsettledByJob, setUnsettledByJob] = useState<Record<string, UnsettledPoll[]>>({});
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [history, setHistory] = useState<CronError[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [errRes, ...unsettledRes] = await Promise.all([
        fetch("/api/monitor/cron-errors", { credentials: "include" }),
        ...JOBS.map((j) =>
          fetch(`/api/monitor/unsettled-polls?job_name=${j.job_name}`, {
            credentials: "include",
          })
        ),
      ]);
      const errJson = await errRes.json();
      if (errJson?.success && errJson?.data) {
        setErrors(Array.isArray(errJson.data.errors) ? errJson.data.errors : []);
        setHistory(Array.isArray(errJson.data.history) ? errJson.data.history : []);
      } else {
        setErrors([]);
        setHistory([]);
      }
      const next: Record<string, UnsettledPoll[]> = {};
      for (let i = 0; i < JOBS.length; i++) {
        const j = JOBS[i];
        const u = await unsettledRes[i].json();
        next[j.job_name] = u?.success && u?.data?.unsettled ? u.data.unsettled : [];
      }
      setUnsettledByJob(next);
    } catch (e) {
      setMessage("조회 실패: " + String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const runSettle = async (pollIds: string[]) => {
    if (pollIds.length === 0) return;
    setSettling(pollIds.join(","));
    setMessage(null);
    try {
      const res = await fetch("/api/admin/backfill-and-settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pollIds }),
      });
      const json = await res.json();
      if (json?.success) {
        const settled = json.data?.settled ?? 0;
        const results = json.data?.results ?? [];
        const failedByPoll = results.filter(
          (r: { failed_user_ids?: string[] }) => Array.isArray(r?.failed_user_ids) && r.failed_user_ids.length > 0
        );
        const errPolls = results.filter(
          (r: { status?: string; error?: string }) => r?.error && r.status !== "settled" && r.status !== "invalid_refund" && r.status !== "already_settled"
        );
        if (failedByPoll.length > 0) {
          const parts = failedByPoll.map(
            (r: { poll_id?: string; failed_user_ids?: string[] }) =>
              `폴 ${r.poll_id ?? "?"}: user_id ${(r.failed_user_ids ?? []).join(", ")} VTC 지급 실패(수동 보정 필요)`
          );
          setMessage(`정산 ${settled}건 완료. 단, 일부 사용자 지급 실패: ${parts.join("; ")}`);
        } else if (errPolls.length > 0) {
          const parts = errPolls.map(
            (r: { poll_id?: string; error?: string }) => `폴 ${r.poll_id ?? "?"}: ${r.error ?? "실패"}`
          );
          setMessage(`정산 ${settled}건 완료. 미처리: ${parts.join("; ")}`);
        } else {
          setMessage(`정산 요청 완료: ${settled}건 처리`);
        }
        fetchAll();
      } else {
        setMessage("실패: " + (json?.error?.message ?? json?.error ?? String(json)));
      }
    } catch (e) {
      setMessage("요청 실패: " + String(e));
    } finally {
      setSettling(null);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">로딩 중...</p>;
  }

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            message.startsWith("실패") || message.startsWith("요청 실패")
              ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
              : "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
          }`}
        >
          {message}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold text-foreground">job별 마지막 실패 (cron_error_log)</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          job당 최근 1건. context에 실패 시도한 candle_start_at 등 포함.
        </p>
        {errors.length === 0 ? (
          <p className="text-muted-foreground">기록된 실패 없음</p>
        ) : (
          <ul className="space-y-3">
            {errors.map((e) => (
              <li
                key={e.job_name}
                className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm"
              >
                <div className="font-semibold text-foreground">{e.job_name}</div>
                <div className="mt-1 text-red-600 dark:text-red-400">
                  [{e.error_code}] {e.error_message}
                </div>
                {e.context && Object.keys(e.context).length > 0 && (
                  <div className="mt-2 text-muted-foreground">
                    context: {JSON.stringify(e.context)}
                  </div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">{e.created_at}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-foreground">최근 실패 이력 (모든 job)</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          실패할 때마다 1건씩 저장. btc_4h, btc_1d 등 모든 job 혼합, 최신순 최대 50건.
        </p>
        {history.length === 0 ? (
          <p className="text-muted-foreground">이력 없음</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2 font-mono text-sm">
            {history.map((e, i) => (
              <li key={`${e.job_name}-${e.created_at}-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium text-foreground">{e.job_name}</span>
                <span className="text-xs text-muted-foreground">{e.created_at}</span>
                <span className="text-red-600 dark:text-red-400">[{e.error_code}] {e.error_message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-foreground">미정산 폴 (캔들 마감됐는데 정산 안 됨)</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          모든 시장(1일/4h/1h/15m/5m). 캔들 마감 + 미정산 + <strong>투표 1건 이상</strong>인 폴만 표시 (무참여/무효 예정 제외). 정산 실행 시 backfill-and-settle로 복구.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {JOBS.map(({ job_name, label }) => {
            const list = unsettledByJob[job_name] ?? [];
            const running = settling !== null && settling.includes(list[0]?.poll_id ?? "");
            return (
              <div key={job_name} className="rounded-lg border border-border p-4">
                <div className="mb-2 font-medium text-foreground">{label} ({job_name})</div>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">없음</p>
                ) : (
                  <>
                    <ul className="mb-3 space-y-1 text-sm">
                      {list.map((p) => (
                        <li key={p.poll_id} className="flex items-center gap-2 font-mono">
                          <span className="text-muted-foreground">{p.candle_start_at}</span>
                          <span className="truncate text-foreground">{p.poll_id}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => runSettle(list.map((p) => p.poll_id))}
                      className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {running ? "처리 중..." : `${list.length}건 정산 실행`}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={fetchAll}
        className="rounded border border-border bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted"
      >
        새로고침
      </button>
    </div>
  );
}
