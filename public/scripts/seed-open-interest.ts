/**
 * 바이낸스 BTC 미결제약정 과거 데이터 전체 수집 스크립트
 *
 * 사용법:
 *   npx ts-node scripts/seed-open-interest.ts
 *
 * - 바이낸스 선물 오픈일(2019-09-13)부터 오늘까지 1일 단위 데이터 수집
 * - 30일씩 페이지네이션으로 요청 (API 제한)
 * - Supabase에 upsert (중복 실행 안전)
 * - 요청 간 딜레이로 API 차단 방지
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BINANCE_FAPI = "https://fapi.binance.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SYMBOL = "BTCUSDT";
const START_DATE = new Date("2019-09-13"); // 바이낸스 선물 오픈일
const DELAY_MS = 500; // 요청 간 딜레이 (ms)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOIHistory(startTime: number, endTime: number) {
  const url = `${BINANCE_FAPI}/futures/data/openInterestHist?symbol=${SYMBOL}&period=1d&limit=30&startTime=${startTime}&endTime=${endTime}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance API error: ${res.status} ${url}`);
  return res.json();
}

async function saveToSupabase(records: any[]) {
  if (records.length === 0) return;

  const rows = records.map((r: any) => ({
    symbol: SYMBOL,
    date: new Date(r.timestamp).toISOString().split("T")[0],
    oi_value: parseFloat(r.sumOpenInterestValue),
    oi_coins: parseFloat(r.sumOpenInterest),
  }));

  const { error } = await supabase
    .from("open_interest_history")
    .upsert(rows, { onConflict: "symbol,date" });

  if (error) throw error;
  return rows.length;
}

async function main() {
  console.log("🚀 바이낸스 BTC OI 과거 데이터 수집 시작");
  console.log(`📅 수집 기간: ${START_DATE.toISOString().split("T")[0]} ~ 오늘`);

  let current = new Date(START_DATE);
  const today = new Date();
  let totalSaved = 0;
  let batchCount = 0;

  while (current < today) {
    const startTime = current.getTime();
    const endTime = Math.min(
      current.getTime() + 30 * 24 * 60 * 60 * 1000, // 30일 후
      today.getTime()
    );

    try {
      const data = await fetchOIHistory(startTime, endTime);

      if (data && data.length > 0) {
        const saved = await saveToSupabase(data);
        totalSaved += saved ?? 0;
        batchCount++;

        const fromDate = new Date(startTime).toISOString().split("T")[0];
        const toDate = new Date(endTime).toISOString().split("T")[0];
        console.log(`✅ [${batchCount}] ${fromDate} ~ ${toDate}: ${data.length}건 저장 (누적 ${totalSaved}건)`);
      }
    } catch (err) {
      console.error(`❌ 오류 발생 (${new Date(startTime).toISOString().split("T")[0]}):`, err);
    }

    // 30일 앞으로 이동
    current = new Date(endTime + 1);
    await sleep(DELAY_MS);
  }

  console.log(`\n🎉 완료! 총 ${totalSaved}건 저장됨`);
}

main().catch(console.error);