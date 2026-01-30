import "server-only";
import { createSupabaseAdmin } from "./server";

/**
 * Supabase Storage 유틸리티
 * - FMP API 원본 데이터 저장/조회
 * - 버킷: fmp-raw-data
 * 
 * 파일 구조:
 * fmp-raw-data/
 * ├── tickers/{year-month}/sp500.json, nasdaq100.json, all.json
 * ├── financials/{year}/{ticker}/income-statement.json, balance-sheet.json, cash-flow.json
 * └── prices/{date}/{ticker}.json
 */

const BUCKET_NAME = "fmp-raw-data";

// ============================================================================
// 현재가 (prices) - 일간 수집
// ============================================================================

/**
 * 현재가 데이터 조회
 * 
 * @param ticker - 종목 티커 (예: 'AAPL')
 * @param date - 데이터 기준일 (YYYY-MM-DD)
 * @returns JSON 데이터 또는 null
 */
export async function getPriceData<T = unknown>(
  ticker: string,
  date: string
): Promise<T | null> {
  const supabase = createSupabaseAdmin();
  
  const filePath = `prices/${date}/${ticker}.json`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(filePath);

  if (error || !data) {
    return null;
  }

  const text = await data.text();
  return JSON.parse(text) as T;
}

/**
 * 특정 날짜의 현재가 티커 목록 조회
 * 
 * @param date - 데이터 기준일 (YYYY-MM-DD)
 * @returns 티커 목록
 */
export async function listPricesByDate(date: string): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`prices/${date}`, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

  if (error || !data) {
    return [];
  }

  // .json 파일명에서 확장자 제거하여 티커명 추출
  return data
    .filter((item) => item.name.endsWith(".json"))
    .map((item) => item.name.replace(".json", ""));
}

// ============================================================================
// 재무제표 (financials) - 연간 수집
// ============================================================================

type FinancialDataType = "income-statement" | "balance-sheet" | "cash-flow";

/**
 * 재무제표 데이터 조회
 * 
 * @param ticker - 종목 티커 (예: 'AAPL')
 * @param dataType - 데이터 타입 ('income-statement', 'balance-sheet', 'cash-flow')
 * @param year - 데이터 연도 (YYYY)
 * @returns JSON 데이터 또는 null
 */
export async function getFinancialData<T = unknown>(
  ticker: string,
  dataType: FinancialDataType,
  year: string
): Promise<T | null> {
  const supabase = createSupabaseAdmin();
  
  const filePath = `financials/${year}/${ticker}/${dataType}.json`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(filePath);

  if (error || !data) {
    return null;
  }

  const text = await data.text();
  return JSON.parse(text) as T;
}

/**
 * 특정 연도의 재무제표 티커 목록 조회
 * 
 * @param year - 연도 (YYYY)
 * @returns 티커 목록
 */
export async function listFinancialsByYear(year: string): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`financials/${year}`, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

  if (error || !data) {
    return [];
  }

  // 폴더명이 티커명 (폴더는 id가 null)
  return data
    .filter((item) => item.id === null)
    .map((item) => item.name);
}

/**
 * 특정 티커의 재무제표 타입 목록 조회
 * 
 * @param ticker - 종목 티커
 * @param year - 연도
 * @returns 데이터 타입 목록
 */
export async function listFinancialTypesByTicker(
  ticker: string,
  year: string
): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`financials/${year}/${ticker}`, {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });

  if (error || !data) {
    return [];
  }

  return data
    .filter((item) => item.name.endsWith(".json"))
    .map((item) => item.name.replace(".json", ""));
}

// ============================================================================
// 티커 목록 (tickers) - 월간 수집
// ============================================================================

type TickerListType = "sp500" | "nasdaq100" | "all";

/**
 * 티커 목록 데이터 조회
 * 
 * @param listType - 목록 타입 ('sp500', 'nasdaq100', 'all')
 * @param yearMonth - 연월 (YYYY-MM)
 * @returns JSON 데이터 또는 null
 */
export async function getTickerList<T = unknown>(
  listType: TickerListType,
  yearMonth: string
): Promise<T | null> {
  const supabase = createSupabaseAdmin();
  
  const filePath = `tickers/${yearMonth}/${listType}.json`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(filePath);

  if (error || !data) {
    return null;
  }

  const text = await data.text();
  return JSON.parse(text) as T;
}

/**
 * 티커 목록이 있는 월 목록 조회
 * 
 * @returns 연월 목록 (예: ['2026-01', '2025-12'])
 */
export async function listTickerMonths(): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list("tickers", {
      limit: 100,
      sortBy: { column: "name", order: "desc" },
    });

  if (error || !data) {
    return [];
  }

  return data
    .filter((item) => item.id === null)
    .map((item) => item.name);
}

// ============================================================================
// 범용 파일 조회 (직접 경로 지정)
// ============================================================================

/**
 * 임의 경로의 파일 조회
 * 
 * @param filePath - 전체 파일 경로 (예: 'prices/2026-01-30/AAPL.json')
 * @returns JSON 데이터 또는 null
 */
export async function getRawFile<T = unknown>(
  filePath: string
): Promise<T | null> {
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(filePath);

  if (error || !data) {
    return null;
  }

  const text = await data.text();
  return JSON.parse(text) as T;
}

/**
 * 폴더 내 파일/폴더 목록 조회
 * 
 * @param folderPath - 폴더 경로 (예: 'prices/2026-01-30')
 * @returns 파일/폴더 목록
 */
export async function listFolder(folderPath: string): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(folderPath, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

  if (error || !data) {
    return [];
  }

  return data.map((item) => item.name);
}

// ============================================================================
// 레거시 호환 (기존 API 지원용)
// ============================================================================

/**
 * @deprecated 새 구조로 마이그레이션됨. getPriceData 또는 getFinancialData 사용
 */
export async function getFmpRawData<T = unknown>(
  ticker: string,
  dataType: "profile" | "income-statement" | "balance-sheet" | "cash-flow" | "key-metrics",
  date: string
): Promise<T | null> {
  // 새 구조로 먼저 시도
  if (dataType === "profile") {
    return getPriceData<T>(ticker, date);
  }
  
  // 재무제표는 연도로 시도 (date에서 연도 추출)
  const year = date.substring(0, 4);
  if (["income-statement", "balance-sheet", "cash-flow"].includes(dataType)) {
    return getFinancialData<T>(ticker, dataType as FinancialDataType, year);
  }
  
  // 기존 경로로 폴백
  const supabase = createSupabaseAdmin();
  const filePath = `${date}/${ticker}/${dataType}.json`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(filePath);

  if (error || !data) {
    return null;
  }

  const text = await data.text();
  return JSON.parse(text) as T;
}

/**
 * @deprecated 새 구조로 마이그레이션됨. listPricesByDate 사용
 */
export async function listTickersByDate(date: string): Promise<string[]> {
  // 새 구조 (prices/)로 먼저 시도
  const newResult = await listPricesByDate(date);
  if (newResult.length > 0) {
    return newResult;
  }
  
  // 기존 구조로 폴백
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(date, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

  if (error || !data) {
    return [];
  }

  return data
    .filter((item) => item.id === null)
    .map((item) => item.name);
}

/**
 * @deprecated saveFmpRawData는 Python 스크립트로 대체됨
 */
export async function saveFmpRawData(
  ticker: string,
  dataType: "profile" | "income-statement" | "balance-sheet" | "cash-flow" | "key-metrics",
  date: string,
  data: unknown
): Promise<string> {
  const supabase = createSupabaseAdmin();
  
  const filePath = `${date}/${ticker}/${dataType}.json`;
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, JSON.stringify(data, null, 2), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to save FMP data: ${error.message}`);
  }

  return filePath;
}

/**
 * @deprecated listDataTypesByTicker는 listFinancialTypesByTicker로 대체됨
 */
export async function listDataTypesByTicker(
  ticker: string,
  date: string
): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`${date}/${ticker}`, {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });

  if (error || !data) {
    return [];
  }

  return data
    .filter((item) => item.name.endsWith(".json"))
    .map((item) => item.name.replace(".json", ""));
}
