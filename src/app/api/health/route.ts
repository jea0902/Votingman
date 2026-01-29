import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { BuffettRun } from "@/lib/supabase/db-types";

/**
 * DB 연결 테스트용 API
 * - public.buffett_run 최신 1건 조회 (run_id, run_date, data_version, universe, data_source)
 */
export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("buffett_run")
      .select("run_id, run_date, data_version, universe, data_source")
      .order("run_date", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const latestRun = (data?.[0] ?? null) as BuffettRun | null;
    return NextResponse.json({ ok: true, latestRun });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
