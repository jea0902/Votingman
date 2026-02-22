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
import * as dotenv from "dotenv";
import * as path from "path";

// .env.local 로드 (루트 디렉토리 기준)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BINANCE_FAPI = "https://fapi.binance.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SYMBOL = "BTCUSDT";
const START_DATE = new Date("2023-01-01"); // 바이낸스 선물 오픈일 2019-09-13 → 2020-09-01 (2020년 이전 데이터는 제공하지 않게 됨.)
const DELAY_MS = 500; // 요청 간 딜레이 (ms)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOIHistory() {
  // startTime/endTime 없이 최근 30일치만 - 결국 최근 30일치가 무료로선 한계
  const params = new URLSearchParams({
    symbol: SYMBOL,
    period: "1d",
    limit: "30",
  });
  const url = `${BINANCE_FAPI}/futures/data/openInterestHist?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
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
  console.log("🚀 BTC OI 최근 30일 데이터 수집 시작");
  const data = await fetchOIHistory();
  const saved = await saveToSupabase(data);
  console.log(`🎉 완료! ${saved}건 저장됨`);
}

main().catch(console.error);