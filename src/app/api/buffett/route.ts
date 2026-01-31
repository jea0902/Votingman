import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type {
  BuffettRun,
  BuffettCardResponse,
} from "@/lib/supabase/db-types";

/**
 * 버핏 카드 데이터 API
 * - 최신 run 기준 결과 조회 (runId 미지정 시)
 * - runId 쿼리 지원
 * - DDL: buffett_result + stocks(FK) + latest_price(stock_id FK, price_date만 사용)
 *   - current_price는 buffett_result 컬럼 사용, price_date는 latest_price 조인
 * 
 * 주의: Supabase는 관계가 1:1이어도 배열 형태로 반환할 수 있음
 */
const parseRunId = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * 배열일 때 첫 요소 선택 유틸 함수
 * - Supabase 관계 데이터가 배열로 올 수 있는 경우 대응
 */
const pickFirst = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

/**
 * Supabase 조인 결과 타입 (배열 허용)
 * - stocks와 latest_price가 배열로 올 수 있음
 */
type BuffettRow = {
  run_id: number;
  stock_id: number;
  total_score: number | null;
  pass_status: string | null;
  current_price: number | null;
  intrinsic_value: number | null;
  gap_pct: number | null;
  recommendation: string | null;
  is_undervalued: boolean | null;
  years_data: number | null;
  trust_grade: number | null;
  trust_grade_text: string | null;
  trust_grade_stars: string | null;
  pass_reason: string | null;
  valuation_reason: string | null;
  created_at: string | null;
  stocks:
    | {
        ticker: string | null;
        company_name: string | null;
        latest_price:
          | {
              current_price: number | null;
              price_date: string | null;
            }
          | {
              current_price: number | null;
              price_date: string | null;
            }[]
          | null;
      }
    | {
        ticker: string | null;
        company_name: string | null;
        latest_price:
          | {
              current_price: number | null;
              price_date: string | null;
            }
          | {
              current_price: number | null;
              price_date: string | null;
            }[]
          | null;
      }[]
    | null;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const runIdParam = parseRunId(request.nextUrl.searchParams.get("runId"));

    let runId = runIdParam;
    let runMeta: BuffettRun | null = null;

    if (!runId) {
      const { data: runData, error: runError } = await supabase
        .from("buffett_run")
        .select("run_id, run_date, data_version, universe, data_source")
        .order("run_date", { ascending: false })
        .limit(1);

      if (runError) {
        return NextResponse.json(
          { ok: false, error: runError.message },
          { status: 500 }
        );
      }

      runMeta = (runData?.[0] ?? null) as BuffettRun | null;
      runId = runMeta?.run_id ?? null;
    }

    if (!runId) {
      return NextResponse.json(
        { ok: false, error: "No run_id found." },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("buffett_result")
      .select(
        `
        run_id,
        stock_id,
        total_score,
        pass_status,
        current_price,
        intrinsic_value,
        gap_pct,
        recommendation,
        is_undervalued,
        years_data,
        trust_grade,
        trust_grade_text,
        trust_grade_stars,
        pass_reason,
        valuation_reason,
        created_at,
        stocks (
          ticker,
          company_name,
          latest_price (
            current_price,
            price_date
          )
        )
      `
      )
      .eq("run_id", runId)
      .order("total_score", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const results = (data ?? []) as BuffettRow[];

    const responseResults: BuffettCardResponse[] = results.map((row) => {
      const stock = pickFirst(row.stocks);
      const latest = pickFirst(stock?.latest_price);
      return {
        run_id: row.run_id,
        stock_id: row.stock_id,
        ticker: stock?.ticker ?? null,
        company_name: stock?.company_name ?? null,
        current_price: latest?.current_price ?? row.current_price ?? null,
        price_date: latest?.price_date ?? null,
        total_score: row.total_score,
        pass_status: row.pass_status,
        intrinsic_value: row.intrinsic_value,
        gap_pct: row.gap_pct,
        recommendation: row.recommendation,
        is_undervalued: row.is_undervalued,
        years_data: row.years_data,
        trust_grade: row.trust_grade,
        trust_grade_text: row.trust_grade_text,
        trust_grade_stars: row.trust_grade_stars,
        pass_reason: row.pass_reason,
        valuation_reason: row.valuation_reason,
        created_at: row.created_at,
      };
    });

    return NextResponse.json({
      ok: true,
      run: runMeta ?? { run_id: runId },
      results: responseResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
