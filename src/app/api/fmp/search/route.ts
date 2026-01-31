import { NextRequest, NextResponse } from "next/server";
import { saveFmpRawData } from "@/lib/supabase/storage";

/**
 * FMP 주식 기호 검색 API
 * - /stable/search-symbol 엔드포인트 사용
 * - NASDAQ만 필터링
 * - 검색 결과를 스토리지에 저장
 * - 사용법: /api/fmp/search?query=AAPL&save=true
 */

const FMP_API_BASE = "https://financialmodelingprep.com/stable";

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

type SearchResult = {
  symbol: string;
  name: string;
  currency: string;
  exchangeFullName: string;
  exchange: string;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query") || "AAPL";
    const save = searchParams.get("save") === "true";
    const exchangeFilter = searchParams.get("exchange") || "NASDAQ"; // 기본값 NASDAQ
    const apiKey = requireEnv("FMP_API_KEY");

    // FMP 검색 API 호출
    const url = `${FMP_API_BASE}/search-symbol?query=${encodeURIComponent(query)}&apikey=${apiKey}`;

    console.log(`[FMP Search] Calling: ${url.replace(apiKey, "***")}`);

    const response = await fetch(url, {
      headers: {
        apikey: apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          ok: false,
          error: `FMP API error: ${response.status} ${response.statusText}`,
          details: errorText,
          url: url.replace(apiKey, "***"),
        },
        { status: response.status }
      );
    }

    const data = (await response.json()) as SearchResult[];

    // Exchange 필터링 (기본값: NASDAQ만)
    const filtered = data.filter((item) => item.exchange === exchangeFilter);

    // 저장 옵션이 켜져있으면 스토리지에 저장
    let savedPath: string | null = null;
    let saveError: string | null = null;
    if (save && filtered.length > 0) {
      try {
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        savedPath = await saveFmpRawData(
          query.toUpperCase(),
          "profile", // 검색 결과는 profile 타입으로 저장
          today,
          {
            query,
            exchangeFilter,
            results: filtered,
            totalResults: data.length,
            filteredResults: filtered.length,
          }
        );
      } catch (error) {
        saveError = error instanceof Error ? error.message : "Unknown error";
        // 버킷이 없을 때 친절한 안내
        if (saveError.includes("Bucket not found")) {
          saveError = "Bucket not found. Supabase 대시보드에서 'fmp-raw-data' 버킷을 생성해주세요. (STORAGE_SETUP.md 참고)";
        }
      }
    }

    return NextResponse.json({
      ok: true,
      query,
      exchangeFilter,
      totalResults: data.length,
      filteredResults: filtered.length,
      results: filtered,
      allResults: data, // 필터링 전 전체 결과도 포함
      saved: save ? (savedPath ? true : false) : false,
      savedPath: savedPath,
      saveError: saveError, // 저장 실패 시 에러 메시지
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    
    // 버킷 에러인 경우 더 친절한 안내
    let hint = "FMP_API_KEY가 .env.local에 설정되어 있는지 확인하세요.";
    if (message.includes("Bucket not found")) {
      hint = "Supabase Storage 버킷이 없습니다. STORAGE_SETUP.md를 참고하여 'fmp-raw-data' 버킷을 생성해주세요. 또는 save=false로 검색만 테스트하세요.";
    }
    
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: hint,
      },
      { status: 500 }
    );
  }
}
