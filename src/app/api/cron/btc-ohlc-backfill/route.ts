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
 *   "btc_4h_range"?: { start_date, end_date, end_date_slot?, batch_size? }  // KST 00/04/08/12/16/20 구간 전체 백필. end_date_slot 0~5(마지막 날 포함할 슬롯), batch_size 기본 100
 * }
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret
 */

import { NextResponse } from "next/server";
import { fetchOhlcForPollDate, fetchCandleByStartAt } from "@/lib/binance/btc-klines";
import { getBtc4hCandleStartAt } from "@/lib/btc-ohlc/candle-utils";
import { upsertBtcOhlcBatch } from "@/lib/btc-ohlc/repository";
import { getOrCreatePollByDateAndMarket } from "@/lib/sentiment/poll-server";
import type { BtcOhlcRow } from "@/lib/binance/btc-klines";
import { isCronAuthorized } from "@/lib/cron/auth";

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BACKFILL_MARKETS = ["btc_1d", "btc_4h", "btc_1h", "btc_15m", "btc_5m"] as const;
const BTC4H_RANGE_DEFAULT_BATCH = 100;

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
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

    const range = body?.btc_4h_range as
      | { start_date?: string; end_date?: string; end_date_slot?: number; batch_size?: number; cursor?: { date: string; slot: number } }
      | undefined;
    if (range?.start_date && range?.end_date && POLL_DATE_REGEX.test(range.start_date) && POLL_DATE_REGEX.test(range.end_date)) {
      const batchSize = Math.min(Math.max(Number(range.batch_size) || BTC4H_RANGE_DEFAULT_BATCH, 1), 200);
      const endSlot = range.end_date_slot != null && range.end_date_slot >= 0 && range.end_date_slot <= 5 ? range.end_date_slot : 5;
      const cursor = range.cursor;
      let curDate = cursor?.date ?? range.start_date;
      let curSlot = cursor?.slot ?? 0;
      const rows: BtcOhlcRow[] = [];
      let totalInserted = 0;
      const endDate = range.end_date;
      while (curDate < endDate || (curDate === endDate && curSlot <= endSlot)) {
        const startAt = getBtc4hCandleStartAt(curDate, curSlot);
        const row = await fetchCandleByStartAt("btc_4h", startAt);
        if (row) rows.push(row);
        if (rows.length >= batchSize) {
          const { inserted } = await upsertBtcOhlcBatch(rows);
          totalInserted += inserted;
          rows.length = 0;
        }
        curSlot += 1;
        if (curSlot > 5) {
          const nextMs = new Date(curDate + "T00:00:00.000Z").getTime() + 24 * 60 * 60 * 1000;
          curDate = new Date(nextMs).toISOString().slice(0, 10);
          curSlot = 0;
        }
        if (curDate > endDate || (curDate === endDate && curSlot > endSlot)) break;
      }
      if (rows.length > 0) {
        const { inserted } = await upsertBtcOhlcBatch(rows);
        totalInserted += inserted;
      }
      const done = curDate > endDate || (curDate === endDate && curSlot > endSlot);
      return NextResponse.json({
        success: true,
        data: {
          message: `btc_4h range backfill ${done ? "완료" : "일부"} (${totalInserted}건 이번 배치)`,
          total_upserted: totalInserted,
          next_cursor: done ? null : { date: curDate, slot: curSlot },
          done,
        },
      });
    }

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
