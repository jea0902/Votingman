import "server-only";
import { saveFmpRawData } from "@/lib/supabase/storage";

/**
 * FMP (Financial Modeling Prep) API 클라이언트
 * - 무료 요금제: 250 calls/day
 * - API Key는 .env.local에 FMP_API_KEY로 저장
 */

const FMP_API_BASE = "https://financialmodelingprep.com/api/v3";

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

/**
 * FMP API 호출 및 스토리지 저장
 * 
 * @param ticker - 종목 티커
 * @param endpoint - FMP API 엔드포인트 (예: 'profile', 'income-statement')
 * @param date - 데이터 기준일 (YYYY-MM-DD)
 * @returns 저장된 파일 경로
 */
export async function fetchAndSaveFmpData(
  ticker: string,
  endpoint: "profile" | "income-statement" | "balance-sheet-statement" | "cash-flow-statement" | "key-metrics",
  date: string
): Promise<string> {
  const apiKey = requireEnv("FMP_API_KEY");
  
  // FMP API 호출
  const url = `${FMP_API_BASE}/${endpoint}/${ticker}?apikey=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // 스토리지에 저장
  const dataType = endpoint === "balance-sheet-statement" 
    ? "balance-sheet" 
    : endpoint === "cash-flow-statement"
    ? "cash-flow"
    : endpoint === "key-metrics"
    ? "key-metrics"
    : endpoint;

  const filePath = await saveFmpRawData(ticker, dataType as any, date, data);

  return filePath;
}

/**
 * 여러 데이터 타입을 한 번에 가져오기
 */
export async function fetchAllFmpDataForTicker(
  ticker: string,
  date: string
): Promise<Record<string, string>> {
  const endpoints: Array<"profile" | "income-statement" | "balance-sheet-statement" | "cash-flow-statement" | "key-metrics"> = [
    "profile",
    "income-statement",
    "balance-sheet-statement",
    "cash-flow-statement",
    "key-metrics",
  ];

  const results: Record<string, string> = {};

  for (const endpoint of endpoints) {
    try {
      const filePath = await fetchAndSaveFmpData(ticker, endpoint, date);
      results[endpoint] = filePath;
      
      // Rate limit 방지: 1초 대기 (무료 요금제: 250 calls/day)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to fetch ${endpoint} for ${ticker}:`, error);
      // 에러가 나도 다음 엔드포인트 계속 시도
    }
  }

  return results;
}
