/**
 * 매일 KST 00:01에 실행되는 크론: 비트코인 시가·종가 DB 반영 + 정산
 *
 * - 당일 시가: 오늘(poll_date=today) 폴의 price_open 기록
 * - 전일 종가: 어제(poll_date=yesterday) 폴의 price_close 기록
 * - 어제 폴 정산: 시가·종가 확정 후 settlePoll(어제, btc) 실행 → 당첨자에게 코인 지급
 * - 투표 유무와 무관하게 (poll_date, market=btc) 행이 없으면 생성 후 갱신
 *
 * 호출: Vercel Cron 또는 외부 스케줄러가 GET 요청. 인증: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getOrCreatePollByDateAndMarket } from "@/lib/sentiment/poll-server";
import { updateBtcOhlcForPoll, settlePoll } from "@/lib/sentiment/settlement-service";
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
      price_open: number | null;
      price_close: number | null;
      poll_created: boolean;
      settle_status?: string;
    }[] = [];

    // 1) 어제 폴: 시가·종가 모두 갱신 (전일 종가가 오늘 00:00에 확정되므로)
    const { poll: pollYesterday, created: createdYesterday } =
      await getOrCreatePollByDateAndMarket(yesterday, "btc");
    const ohlcYesterday = await updateBtcOhlcForPoll(yesterday, pollYesterday.id);

    // 1-1) 어제 폴 정산: 시가·종가 확정 후 당첨자에게 코인 지급
    const settleResult = await settlePoll(yesterday, "btc");

    results.push({
      date: yesterday,
      price_open: ohlcYesterday.price_open,
      price_close: ohlcYesterday.price_close,
      poll_created: createdYesterday,
      settle_status: settleResult.status,
    });

    // 2) 오늘 폴: 시가 갱신 (종가는 내일 00:01에)
    const { poll: pollToday, created: createdToday } =
      await getOrCreatePollByDateAndMarket(today, "btc");
    const ohlcToday = await updateBtcOhlcForPoll(today, pollToday.id);
    results.push({
      date: today,
      price_open: ohlcToday.price_open,
      price_close: ohlcToday.price_close,
      poll_created: createdToday,
    });

    // 3) 미정산 과거 폴 재시도 (최근 7일, Binance 일시 실패 등 대비)
    const retrySettlements: { poll_date: string; status: string }[] = [];
    const admin = createSupabaseAdmin();
    const [ty, tm, td] = today.split("-").map(Number);
    const sevenDaysAgoDate = new Date(ty, tm - 1, td);
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
    const sevenDaysAgoStr =
      sevenDaysAgoDate.getFullYear() +
      "-" +
      String(sevenDaysAgoDate.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(sevenDaysAgoDate.getDate()).padStart(2, "0");
    const { data: unsettledPolls } = await admin
      .from("sentiment_polls")
      .select("poll_date")
      .eq("market", "btc")
      .is("settled_at", null)
      .lt("poll_date", today)
      .gte("poll_date", sevenDaysAgoStr);
    for (const row of unsettledPolls ?? []) {
      const pastDate = row.poll_date as string;
      if (pastDate === yesterday) continue; // 이미 1)에서 처리함
      const retryResult = await settlePoll(pastDate, "btc");
      retrySettlements.push({ poll_date: pastDate, status: retryResult.status });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "BTC OHLC daily cron completed",
        kst_today: today,
        results,
        retry_settlements: retrySettlements,
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
