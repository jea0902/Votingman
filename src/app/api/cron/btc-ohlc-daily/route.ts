/**
 * 매일 KST 00:01에 실행되는 크론: 비트코인 시가·종가 DB 반영
 *
 * - 당일 시가: 오늘(poll_date=today) 폴의 btc_open 기록
 * - 전일 종가: 어제(poll_date=yesterday) 폴의 btc_close 기록
 * - 투표 유무와 무관하게 (poll_date, market=btc) 행이 없으면 생성 후 갱신
 *
 * 호출: Vercel Cron 또는 외부 스케줄러가 GET 요청. 인증: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { getOrCreatePollByDateAndMarket } from "@/lib/sentiment/poll-server";
import { updateBtcOhlcForPoll } from "@/lib/sentiment/settlement-service";
import { getTodayKstDateString } from "@/lib/binance/btc-kst";

function getYesterdayKstDateString(): string {
  const today = getTodayKstDateString();
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

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

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const today = getTodayKstDateString();
    const yesterday = getYesterdayKstDateString();

    const results: {
      date: string;
      btc_open: number | null;
      btc_close: number | null;
      poll_created: boolean;
    }[] = [];

    // 1) 어제 폴: 시가·종가 모두 갱신 (전일 종가가 오늘 00:00에 확정되므로)
    const { poll: pollYesterday, created: createdYesterday } =
      await getOrCreatePollByDateAndMarket(yesterday, "btc");
    const ohlcYesterday = await updateBtcOhlcForPoll(yesterday, pollYesterday.id);
    results.push({
      date: yesterday,
      btc_open: ohlcYesterday.btc_open,
      btc_close: ohlcYesterday.btc_close,
      poll_created: createdYesterday,
    });

    // 2) 오늘 폴: 시가 갱신 (종가는 내일 00:01에)
    const { poll: pollToday, created: createdToday } =
      await getOrCreatePollByDateAndMarket(today, "btc");
    const ohlcToday = await updateBtcOhlcForPoll(today, pollToday.id);
    results.push({
      date: today,
      btc_open: ohlcToday.btc_open,
      btc_close: ohlcToday.btc_close,
      poll_created: createdToday,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: "BTC OHLC daily cron completed",
        kst_today: today,
        results,
      },
    });
  } catch (e) {
    console.error("[cron/btc-ohlc-daily] error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
