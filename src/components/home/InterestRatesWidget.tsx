"use client";

import { useEffect, useState } from "react";

export function InterestRatesWidget() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{
    us: number | null;
    kr: number | null;
    de: number | null;
    jp: number | null;
  }>({ us: null, kr: null, de: null, jp: null });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch("/api/market/interest-rates-10y", { cache: "no-store" });
        if (!res.ok) throw new Error(`interest-rates request failed: ${res.status}`);

        const json = await res.json();
        if (!json?.success) {
          throw new Error(json?.error?.message ?? "금리 정보를 불러오지 못했습니다.");
        }

        const data: Array<{ key: "us" | "kr" | "de" | "jp"; value: number | null }> =
          json?.data ?? [];

        if (cancelled) return;

        const next = {
          us: data.find((d) => d.key === "us")?.value ?? null,
          kr: data.find((d) => d.key === "kr")?.value ?? null,
          de: data.find((d) => d.key === "de")?.value ?? null,
          jp: data.find((d) => d.key === "jp")?.value ?? null,
        };

        setRows(next);
        setError(null);
        setLoading(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "금리 정보를 불러오지 못했습니다.";
        if (!cancelled) {
          setError(msg);
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">금리(10Y)</p>
          <p className="mt-1 text-sm font-bold text-foreground">미국/한국/유럽/일본</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">{error}</p>
          <div className="mt-2 space-y-1 text-[11px]">
            <p>미국 10년물: --</p>
            <p>한국 10년물: --</p>
            <p>유럽 10년물: --</p>
            <p>일본 10년물: --</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background p-3">
          {loading ? (
            <div className="min-h-[86px] flex items-center justify-center">
              <span className="text-xs text-muted-foreground">금리 불러오는 중…</span>
            </div>
          ) : (
            <div className="space-y-1 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">미국 10년물</span>
                <span className="font-semibold">
                  {rows.us == null ? "--" : `${rows.us.toFixed(3)}%`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">한국 10년물</span>
                <span className="font-semibold">
                  {rows.kr == null ? "--" : `${rows.kr.toFixed(3)}%`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">유럽 10년물</span>
                <span className="font-semibold">
                  {rows.de == null ? "--" : `${rows.de.toFixed(3)}%`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">일본 10년물</span>
                <span className="font-semibold">
                  {rows.jp == null ? "--" : `${rows.jp.toFixed(3)}%`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

