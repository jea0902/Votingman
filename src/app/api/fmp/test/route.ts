import { NextRequest, NextResponse } from "next/server";

/**
 * FMP API 테스트용 엔드포인트
 * - 스토리지 저장 없이 API 호출만 테스트
 * - 사용법: /api/fmp/test?ticker=AAPL&endpoint=profile
 */

// FMP API는 /api/v3가 Legacy로 변경되어 /stable 사용
const FMP_API_BASE = "https://financialmodelingprep.com/stable";

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ticker = searchParams.get("ticker") || "AAPL";
    const endpoint = searchParams.get("endpoint") || "profile";
    const apiKey = requireEnv("FMP_API_KEY");

    // FMP API 엔드포인트 매핑
    const endpointMap: Record<string, string> = {
      profile: "profile",
      "income-statement": "income-statement",
      "balance-sheet": "balance-sheet-statement",
      "cash-flow": "cash-flow-statement",
      "key-metrics": "key-metrics",
      "company-key-metrics": "key-metrics-ttm",
      "ratios": "ratios-ttm",
      "enterprise-value": "enterprise-values",
    };

    const fmpEndpoint = endpointMap[endpoint] || endpoint;
    const url = `${FMP_API_BASE}/${fmpEndpoint}/${ticker}?apikey=${apiKey}`;

    console.log(`[FMP Test] Calling: ${url.replace(apiKey, "***")}`);

    // URL 쿼리 매개변수로 API 키 전달 (이미 url에 포함됨)
    // 헤더 인증도 함께 사용 (FMP 문서 권장)
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

    const data = await response.json();

    return NextResponse.json({
      ok: true,
      ticker,
      endpoint: fmpEndpoint,
      dataLength: Array.isArray(data) ? data.length : 1,
      data: data,
      // 첫 번째 항목만 미리보기 (전체 데이터는 data 필드에)
      preview: Array.isArray(data) ? data[0] : data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: "FMP_API_KEY가 .env.local에 설정되어 있는지 확인하세요.",
      },
      { status: 500 }
    );
  }
}
