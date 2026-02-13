/**
 * 비트코인 OHLC 과거 날짜 일괄 수집 (백필)
 * - 오늘 이전 데이터를 btc_ohlc에 채울 때 사용
 *
 * POST /api/cron/btc-ohlc-backfill
 * body: {
 *   "poll_dates": ["2025-02-04", "2025-02-05"],
 *   "markets"?: ["btc_1d", "btc_4h", "btc_1h", "btc_15m"]  // 생략 시 전체
 * }
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret
 */

import { NextResponse } from "next/server";
import { fetchOhlcForPollDate } from "@/lib/binance/btc-klines";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";
import { getOrCreatePollByDateAndMarket } from "@/lib/sentiment/poll-server";

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BACKFILL_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m"] as const;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7) === secret;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  return headerSecret === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const raw = body?.poll_dates;
    const poll_dates: string[] = Array.isArray(raw)
      ? raw
          .filter((d: unknown): d is string => typeof d === "string")
          .map((d: string) => d.trim())
          .filter((d: string) => POLL_DATE_REGEX.test(d))
      : [];

    const marketsRaw = body?.markets;
    const markets: string[] = Array.isArray(marketsRaw)
      ? marketsRaw.filter((m: unknown) =>
          BACKFILL_MARKETS.includes(m as (typeof BACKFILL_MARKETS)[number])
        )
      : [...BACKFILL_MARKETS];

    if (poll_dates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "poll_dates 배열에 YYYY-MM-DD 형식 날짜를 넣어주세요.",
          },
        },
        { status: 400 }
      );
    }

    const results: {
      poll_date: string;
      market: string;
      upserted: number;
      poll_created?: boolean;
    }[] = [];
    let totalUpserted = 0;

    for (const pollDate of poll_dates) {
      const created = await getOrCreatePollByDateAndMarket(pollDate, "btc_1d")
        .then((r) => r.created)
        .catch(() => false);

      for (const market of markets) {
        const rows = await fetchOhlcForPollDate(market, pollDate);
        const { inserted } = await upsertBtcOhlcBatch(rows);
        totalUpserted += inserted;
        results.push({
          poll_date: pollDate,
          market,
          upserted: inserted,
          poll_created: market === "btc_1d" ? created : undefined,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "BTC OHLC backfill completed",
        count: results.length,
        total_upserted: totalUpserted,
        results,
      },
    });
  } catch (e) {
    console.error("[cron/btc-ohlc-backfill] error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
