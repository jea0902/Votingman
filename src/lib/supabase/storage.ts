import "server-only";
import { createSupabaseAdmin } from "./server";

/**
 * Supabase Storage 유틸리티
 * - FMP API 원본 데이터 저장/조회
 * - 버킷: fmp-raw-data
 */

const BUCKET_NAME = "fmp-raw-data";

/**
 * FMP 원본 데이터 저장
 * 
 * @param ticker - 종목 티커 (예: 'AAPL')
 * @param dataType - 데이터 타입 ('profile', 'income-statement', 'balance-sheet', 'cash-flow', 'key-metrics')
 * @param date - 데이터 기준일 (YYYY-MM-DD)
 * @param data - 저장할 JSON 데이터
 * @returns 저장된 파일 경로
 */
export async function saveFmpRawData(
  ticker: string,
  dataType: "profile" | "income-statement" | "balance-sheet" | "cash-flow" | "key-metrics",
  date: string,
  data: unknown
): Promise<string> {
  const supabase = createSupabaseAdmin();
  
  // 파일 경로: {date}/{ticker}/{dataType}.json
  const filePath = `${date}/${ticker}/${dataType}.json`;
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, JSON.stringify(data, null, 2), {
      contentType: "application/json",
      upsert: true, // 이미 있으면 덮어쓰기
    });

  if (error) {
    throw new Error(`Failed to save FMP data: ${error.message}`);
  }

  return filePath;
}

/**
 * FMP 원본 데이터 조회
 * 
 * @param ticker - 종목 티커
 * @param dataType - 데이터 타입
 * @param date - 데이터 기준일
 * @returns JSON 데이터 또는 null
 */
export async function getFmpRawData<T = unknown>(
  ticker: string,
  dataType: "profile" | "income-statement" | "balance-sheet" | "cash-flow" | "key-metrics",
  date: string
): Promise<T | null> {
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
 * 특정 날짜의 모든 티커 목록 조회
 * 
 * @param date - 데이터 기준일
 * @returns 티커 목록
 */
export async function listTickersByDate(date: string): Promise<string[]> {
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

  // 폴더명이 티커명
  return data
    .filter((item) => item.id === null) // 폴더만 필터링
    .map((item) => item.name);
}

/**
 * 특정 티커의 모든 데이터 타입 목록 조회
 * 
 * @param ticker - 종목 티커
 * @param date - 데이터 기준일
 * @returns 데이터 타입 목록
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

  // .json 파일명에서 확장자 제거
  return data
    .filter((item) => item.name.endsWith(".json"))
    .map((item) => item.name.replace(".json", ""));
}
