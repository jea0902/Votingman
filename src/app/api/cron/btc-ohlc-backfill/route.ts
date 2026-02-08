/**
 * 비트코인 시가·종가 과거 날짜 일괄 반영 (백필)
 *
 * POST /api/cron/btc-ohlc-backfill
 * body: { "poll_dates": ["2025-02-04", "2025-02-05", "2025-02-06"] }
 * 인증: Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret
 */

import { NextResponse } from "next/server";
import { getOrCreatePollByDateAndMarket } from "@/lib/sentiment/poll-server";
import { updateBtcOhlcForPoll } from "@/lib/sentiment/settlement-service";

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
          // 1) 문자열만 남기고
          .filter((d: unknown): d is string => typeof d === "string")
          // 2) 앞뒤 공백 제거 후
          .map((d: string) => d.trim())
          // 3) YYYY-MM-DD 형식인 것만 사용
          .filter((d: string) => POLL_DATE_REGEX.test(d))
      : [];

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
      price_open: number | null;
      price_close: number | null;
      poll_created: boolean;
    }[] = [];

    for (const pollDate of poll_dates) {
      const { poll, created } = await getOrCreatePollByDateAndMarket(pollDate, "btc");
      const ohlc = await updateBtcOhlcForPoll(pollDate, poll.id);
      results.push({
        poll_date: pollDate,
        price_open: ohlc.price_open,
        price_close: ohlc.price_close,
        poll_created: created,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "BTC OHLC backfill completed",
        count: results.length,
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
