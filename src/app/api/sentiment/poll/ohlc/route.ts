/**
 * 비트코인 폴 시가·종가 DB 반영 (Binance 조회 후 sentiment_polls 업데이트)
 * - 정산 전 시가/종가가 null인 폴을 채울 때 사용
 *
 * POST /api/sentiment/poll/ohlc
 * body: { poll_date: "YYYY-MM-DD", market?: "btc" } (market 생략 시 btc)
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { updateBtcOhlcForPoll } from "@/lib/sentiment/settlement-service";

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pollDate = body?.poll_date;
    const market = body?.market === "btc" ? "btc" : "btc";

    if (!pollDate || !POLL_DATE_REGEX.test(pollDate)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "poll_date는 YYYY-MM-DD 형식이어야 합니다.",
          },
        },
        { status: 400 }
      );
    }

    if (market !== "btc") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "현재 비트코인(btc) 시장만 시가/종가 반영을 지원합니다.",
          },
        },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const { data: poll } = await admin
      .from("sentiment_polls")
      .select("id")
      .eq("poll_date", pollDate)
      .eq("market", market)
      .maybeSingle();

    if (!poll) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "해당 날짜/시장의 폴이 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    const { btc_open, btc_close } = await updateBtcOhlcForPoll(pollDate, poll.id);

    return NextResponse.json({
      success: true,
      data: {
        poll_date: pollDate,
        market,
        btc_open,
        btc_close,
      },
    });
  } catch (e) {
    console.error("[sentiment/poll/ohlc] error:", e);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "시가·종가 반영 중 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
