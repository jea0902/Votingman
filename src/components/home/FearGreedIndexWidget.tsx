"use client";

import { useEffect, useState } from "react";

type FearGreedIndexRow = {
  value: number;
  valueClassification: string;
  timestamp: number | null;
};

export function FearGreedIndexWidget() {
  const [row, setRow] = useState<FearGreedIndexRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch("https://api.alternative.me/fng/?limit=1&format=json", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`FNG fetch failed: ${res.status}`);
        const json = await res.json();
        const item = json?.data?.[0];
        const value = Number(item?.value);
        const classification = String(item?.value_classification ?? "");
        const ts = item?.timestamp != null ? Number(item.timestamp) : null;
        if (!cancelled) {
          setRow(
            Number.isFinite(value)
              ? { value, valueClassification: classification, timestamp: ts }
              : null
          );
        }
      } catch {
        if (!cancelled) setRow(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayValue = row ? row.value : "--";
  const classificationRaw = row ? row.valueClassification : "--";

  const classificationKor = (() => {
    if (loading) return "";
    if (!row) return "--";
    switch (classificationRaw) {
      case "Extreme Fear":
        return "극도의 공포";
      case "Fear":
        return "공포";
      case "Neutral":
        return "중립";
      case "Greed":
        return "탐욕";
      case "Extreme Greed":
        return "극도의 탐욕";
      default:
        return classificationRaw;
    }
  })();

  return (
    <section className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">코인 공포/탐욕 지수</p>
          <p className="mt-1 text-lg font-extrabold text-foreground">
            {loading ? "…" : displayValue}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loading ? "" : classificationKor}
          </p>
        </div>
      </div>

      {!loading && row?.timestamp ? (
        <p className="mt-3 text-[10px] text-muted-foreground">
          기준 시각: {new Date(row.timestamp * 1000).toLocaleString("ko-KR")}
        </p>
      ) : null}
    </section>
  );
}

