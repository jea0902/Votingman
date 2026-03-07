/**
 * 비트코인 OHLC 과거 날짜 일괄 수집 (백필)
 *
 * DB 수집 로직 (한 봉 기준):
 * 1. Binance API로 해당 봉 OHLC 조회 (fetchCandleByStartAt 또는 fetchOhlcForPollDate)
 * 2. upsertBtcOhlcBatch(rows) → btc_ohlc 테이블에 upsert (market, candle_start_at 기준)
 * 즉, "바이낸스에서 가져와서 btc_ohlc에 넣는 것"이 전부.
 *
 * POST /api/cron/btc-ohlc-backfill
 * body: {
 *   "poll_dates": ["2025-02-04", "2025-02-05"],
 *   "markets"?: ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"],  // 생략 시 전체
 *   "btc_4h_slots"?: [0,1,2,3,4,5]  // 0=00시, 1=04시, 2=08시(12시 마감), 3=12시, 4=16시, 5=20시 KST 시작. 생략 시 해당일 6개 전부
 * }
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret
 */

import { NextResponse } from "next/server";
import { fetchOhlcForPollDate, fetchCandleByStartAt } from "@/lib/binance/btc-klines";
import { getBtc4hCandleStartAt } from "@/lib/btc-ohlc/candle-utils";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";
import { getOrCreatePollByDateAndMarket } from "@/lib/sentiment/poll-server";

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BACKFILL_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"] as const;

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

    const btc4hSlotsRaw = body?.btc_4h_slots;
    const btc_4h_slots: number[] | undefined = Array.isArray(btc4hSlotsRaw)
      ? btc4hSlotsRaw
          .filter((n: unknown) => typeof n === "number" && n >= 0 && n <= 5)
          .map((n: number) => Math.floor(n))
      : undefined;

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
        let rows: Awaited<ReturnType<typeof fetchOhlcForPollDate>>;
        if (market === "btc_4h" && btc_4h_slots != null && btc_4h_slots.length > 0) {
          rows = [];
          for (const slot of btc_4h_slots) {
            const startAt = getBtc4hCandleStartAt(pollDate, slot);
            const row = await fetchCandleByStartAt("btc_4h", startAt);
            if (row) rows.push(row);
          }
        } else {
          rows = await fetchOhlcForPollDate(market, pollDate);
        }
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
