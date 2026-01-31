import { NextRequest, NextResponse } from "next/server";
import { 
  getPriceData, 
  getFinancialData, 
  getTickerList,
  getRawFile 
} from "@/lib/supabase/storage";

/**
 * 스토리지 파일 내용 읽기 API
 * 
 * 사용법:
 * - 현재가: /api/fmp/storage/read?type=prices&ticker=AAPL&date=2026-01-30
 * - 재무제표: /api/fmp/storage/read?type=financials&ticker=AAPL&year=2026&dataType=income-statement
 * - 티커목록: /api/fmp/storage/read?type=tickers&listType=all&yearMonth=2026-01
 * - 범용: /api/fmp/storage/read?path=prices/2026-01-30/AAPL.json
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const path = searchParams.get("path");
    const ticker = searchParams.get("ticker");
    const date = searchParams.get("date");
    const year = searchParams.get("year");
    const dataType = searchParams.get("dataType");
    const listType = searchParams.get("listType");
    const yearMonth = searchParams.get("yearMonth");

    // 범용 파일 읽기
    if (path) {
      const data = await getRawFile(path);
      if (!data) {
        return NextResponse.json(
          {
            ok: false,
            error: "File not found",
            path,
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        ok: true,
        path,
        data,
      });
    }

    // 타입별 조회
    if (!type) {
      return NextResponse.json(
        {
          ok: false,
          error: "type 또는 path 파라미터가 필요합니다.",
          examples: [
            "/api/fmp/storage/read?type=prices&ticker=AAPL&date=2026-01-30",
            "/api/fmp/storage/read?type=financials&ticker=AAPL&year=2026&dataType=income-statement",
            "/api/fmp/storage/read?type=tickers&listType=all&yearMonth=2026-01",
            "/api/fmp/storage/read?path=prices/2026-01-30/AAPL.json",
          ],
        },
        { status: 400 }
      );
    }

    switch (type) {
      case "prices": {
        if (!ticker || !date) {
          return NextResponse.json(
            {
              ok: false,
              error: "prices 타입에는 ticker와 date 파라미터가 필요합니다.",
              example: "/api/fmp/storage/read?type=prices&ticker=AAPL&date=2026-01-30",
            },
            { status: 400 }
          );
        }
        const data = await getPriceData(ticker.toUpperCase(), date);
        if (!data) {
          return NextResponse.json(
            {
              ok: false,
              error: "File not found",
              ticker: ticker.toUpperCase(),
              date,
            },
            { status: 404 }
          );
        }
        return NextResponse.json({
          ok: true,
          type: "prices",
          ticker: ticker.toUpperCase(),
          date,
          data,
        });
      }

      case "financials": {
        if (!ticker || !year || !dataType) {
          return NextResponse.json(
            {
              ok: false,
              error: "financials 타입에는 ticker, year, dataType 파라미터가 필요합니다.",
              example: "/api/fmp/storage/read?type=financials&ticker=AAPL&year=2026&dataType=income-statement",
              allowedDataTypes: ["income-statement", "balance-sheet", "cash-flow"],
            },
            { status: 400 }
          );
        }
        
        const validDataTypes = ["income-statement", "balance-sheet", "cash-flow"];
        if (!validDataTypes.includes(dataType)) {
          return NextResponse.json(
            {
              ok: false,
              error: `Invalid dataType: ${dataType}`,
              allowedDataTypes: validDataTypes,
            },
            { status: 400 }
          );
        }
        
        const data = await getFinancialData(
          ticker.toUpperCase(), 
          dataType as "income-statement" | "balance-sheet" | "cash-flow",
          year
        );
        if (!data) {
          return NextResponse.json(
            {
              ok: false,
              error: "File not found",
              ticker: ticker.toUpperCase(),
              year,
              dataType,
            },
            { status: 404 }
          );
        }
        return NextResponse.json({
          ok: true,
          type: "financials",
          ticker: ticker.toUpperCase(),
          year,
          dataType,
          data,
        });
      }

      case "tickers": {
        if (!listType || !yearMonth) {
          return NextResponse.json(
            {
              ok: false,
              error: "tickers 타입에는 listType과 yearMonth 파라미터가 필요합니다.",
              example: "/api/fmp/storage/read?type=tickers&listType=all&yearMonth=2026-01",
              allowedListTypes: ["sp500", "nasdaq100", "all"],
            },
            { status: 400 }
          );
        }
        
        const validListTypes = ["sp500", "nasdaq100", "all"];
        if (!validListTypes.includes(listType)) {
          return NextResponse.json(
            {
              ok: false,
              error: `Invalid listType: ${listType}`,
              allowedListTypes: validListTypes,
            },
            { status: 400 }
          );
        }
        
        const data = await getTickerList(
          listType as "sp500" | "nasdaq100" | "all",
          yearMonth
        );
        if (!data) {
          return NextResponse.json(
            {
              ok: false,
              error: "File not found",
              listType,
              yearMonth,
            },
            { status: 404 }
          );
        }
        return NextResponse.json({
          ok: true,
          type: "tickers",
          listType,
          yearMonth,
          data,
        });
      }

      default:
        return NextResponse.json(
          {
            ok: false,
            error: `Unknown type: ${type}`,
            allowedTypes: ["prices", "financials", "tickers"],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
