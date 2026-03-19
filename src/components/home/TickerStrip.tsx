"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TickerRow = {
  key: string;
  label: string;
  value: number | null;
  changePct: number | null;
};

function formatValue(v: number | null): string {
  if (v == null) return "--";
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatPct(v: number | null): string {
  if (v == null) return "--";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function TickerStrip() {
  const [tickers, setTickers] = useState<TickerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);

  const fetchTickers = useCallback(async () => {
    try {
      const res = await fetch("/api/market/ticker-strip", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const json = await res.json();
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setTickers(json.data as TickerRow[]);
      }
    } catch {
      // keep previous tickers on transient failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickers();
    const t = setInterval(fetchTickers, 30_000);
    return () => clearInterval(t);
  }, [fetchTickers]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (tickers.length === 0) return;

    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      if (!paused) {
        const max = el.scrollWidth - el.clientWidth;
        if (max <= 0) {
          // content fits: no-op
        } else if (el.scrollLeft >= max - 1) {
          el.scrollLeft = 0;
        } else {
          el.scrollLeft += 1;
        }
      }
    };

    const interval = window.setInterval(step, 80);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [paused, tickers.length]);

  return (
    <section aria-label="글로벌 티커 한줄 보기" className="rounded-xl border border-border bg-card/60 p-2">
      <div
        ref={scrollerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {loading && tickers.length === 0 ? (
          <span className="px-2 py-1 text-xs text-muted-foreground">티커 불러오는 중...</span>
        ) : (
          tickers.map((t) => {
            const up = (t.changePct ?? 0) > 0;
            const down = (t.changePct ?? 0) < 0;
            return (
              <div
                key={t.key}
                className="shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5"
              >
                <p className="text-[10px] font-medium text-muted-foreground">{t.label}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{formatValue(t.value)}</span>
                  <span
                    className={`text-[11px] font-semibold ${
                      up ? "text-emerald-500" : down ? "text-rose-500" : "text-muted-foreground"
                    }`}
                  >
                    {formatPct(t.changePct)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

