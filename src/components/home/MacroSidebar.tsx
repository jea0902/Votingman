"use client";

import { FearGreedIndexWidget } from "./FearGreedIndexWidget";
import { EconomicCalendar } from "./EconomicCalendar";
import { InterestRatesWidget } from "./InterestRatesWidget";

export function MacroSidebar() {
  return (
    <div className="space-y-4">
      <FearGreedIndexWidget />

      <div className="rounded-xl border border-border bg-card/60 p-0">
        <div className="h-[260px] overflow-hidden">
          <EconomicCalendar className="h-full" />
        </div>
      </div>

      <InterestRatesWidget />
    </div>
  );
}

