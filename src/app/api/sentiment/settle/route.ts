/**
 * 보팅맨 정산 API (마감 후 실행)
 * 명세: docs/votingman-implementation-phases.md 3단계
 *
 * POST /api/sentiment/settle
 * body: { poll_date?: "YYYY-MM-DD", market?: "btc_1d", candle_start_at?: "ISO" }
 * - btc_1d: poll_date만 있으면 됨 (생략 시 어제 KST)
 * - btc_4h, btc_1h, btc_15m: candle_start_at 필수 (마감된 캔들 시각)
 *
 * - 이미 정산된 폴은 재실행하지 않음
 */

import { NextResponse } from "next/server";
import { settlePoll } from "@/lib/sentiment/settlement-service";
import { getTodayKstDateString } from "@/lib/binance/btc-kst";
import { refreshMarketSeason } from "@/lib/tier/tier-service";
import { getCurrentSeasonId } from "@/lib/constants/seasons";
import { TIER_MARKET_ALL } from "@/lib/tier/constants";

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getYesterdayKst(): string {
  const today = getTodayKstDateString();
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function POST(request: Request) {
  try {
    let poll_date: string;
    let market: string;
    let candle_start_at: string | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      const pollDateParam = body?.poll_date ?? null;
      poll_date =
        pollDateParam && POLL_DATE_REGEX.test(pollDateParam)
          ? pollDateParam
          : getYesterdayKst();
      market = body?.market ?? "btc_1d";
      candle_start_at =
        typeof body?.candle_start_at === "string" && body.candle_start_at
          ? body.candle_start_at
          : undefined;
    } catch {
      poll_date = getYesterdayKst();
      market = "btc_1d";
      candle_start_at = undefined;
    }

    const result = await settlePoll(poll_date, market, candle_start_at);

    // 정산 성공 시 user_stats(누적 승률·MMR) 갱신
    if (result.status === "settled" || result.status === "one_side_refund" || result.status === "draw_refund") {
      const seasonId = getCurrentSeasonId();
      await refreshMarketSeason(TIER_MARKET_ALL, seasonId);
    }

    if (result.error && result.status === "already_settled") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SETTLE_SKIPPED",
            message: result.error,
          },
          data: result,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (e) {
    console.error("[sentiment/settle] error:", e);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "정산 처리 중 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
