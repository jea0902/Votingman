import { NextRequest, NextResponse } from "next/server";
import { 
  listPricesByDate, 
  listFinancialsByYear, 
  listTickerMonths,
  listFolder 
} from "@/lib/supabase/storage";

/**
 * 스토리지 파일 목록 조회 API
 * 
 * 사용법:
 * - 현재가 목록: /api/fmp/storage/list?type=prices&date=2026-01-30
 * - 재무제표 목록: /api/fmp/storage/list?type=financials&year=2026
 * - 티커목록 월: /api/fmp/storage/list?type=tickers
 * - 범용 폴더: /api/fmp/storage/list?path=prices/2026-01-30
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const date = searchParams.get("date");
    const year = searchParams.get("year");
    const path = searchParams.get("path");

    // 범용 폴더 조회
    if (path) {
      const items = await listFolder(path);
      return NextResponse.json({
        ok: true,
        path,
        count: items.length,
        items,
      });
    }

    // 타입별 조회
    if (!type) {
      return NextResponse.json(
        {
          ok: false,
          error: "type 또는 path 파라미터가 필요합니다.",
          examples: [
            "/api/fmp/storage/list?type=prices&date=2026-01-30",
            "/api/fmp/storage/list?type=financials&year=2026",
            "/api/fmp/storage/list?type=tickers",
            "/api/fmp/storage/list?path=prices/2026-01-30",
          ],
        },
        { status: 400 }
      );
    }

    switch (type) {
      case "prices": {
        if (!date) {
          return NextResponse.json(
            {
              ok: false,
              error: "prices 타입에는 date 파라미터가 필요합니다.",
              example: "/api/fmp/storage/list?type=prices&date=2026-01-30",
            },
            { status: 400 }
          );
        }
        const tickers = await listPricesByDate(date);
        return NextResponse.json({
          ok: true,
          type: "prices",
          date,
          tickerCount: tickers.length,
          tickers,
        });
      }

      case "financials": {
        if (!year) {
          return NextResponse.json(
            {
              ok: false,
              error: "financials 타입에는 year 파라미터가 필요합니다.",
              example: "/api/fmp/storage/list?type=financials&year=2026",
            },
            { status: 400 }
          );
        }
        const tickers = await listFinancialsByYear(year);
        return NextResponse.json({
          ok: true,
          type: "financials",
          year,
          tickerCount: tickers.length,
          tickers,
        });
      }

      case "tickers": {
        const months = await listTickerMonths();
        return NextResponse.json({
          ok: true,
          type: "tickers",
          monthCount: months.length,
          months,
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
