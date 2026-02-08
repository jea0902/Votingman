"use client";

/**
 * 투표 마감까지 남은 시간 카운트다운
 */

import { useState, useEffect } from "react";
import { getMillisUntilClose } from "@/lib/utils/sentiment-vote";
import type { SentimentMarket } from "@/lib/constants/sentiment-markets";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "마감됨";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}시간 ${String(mins).padStart(2, "0")}분 ${String(secs).padStart(2, "0")}초`;
  }
  return `${String(mins).padStart(2, "0")}분 ${String(secs).padStart(2, "0")}초`;
}

type Props = {
  market: SentimentMarket;
};

export function CountdownTimer({ market }: Props) {
  const [ms, setMs] = useState(() => getMillisUntilClose(market));

  useEffect(() => {
    const tick = () => setMs(getMillisUntilClose(market));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [market]);

  return (
    <span className="font-mono font-semibold text-amber-500 tabular-nums">
      {formatCountdown(ms)}
    </span>
  );
}
