import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * OI 차트 데이터 조회 API
 * - OI 데이터 + 같은 날짜의 BTC 가격 데이터 함께 반환
 *
 * Query params:
 *   period: "1m" | "3m" | "6m" | "1y" | "all" (기본값: "3m")
 *   symbol: "BTCUSDT" (기본값)
 */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "3m";
    const symbol = searchParams.get("symbol") ?? "BTCUSDT";

    // 기간별 시작일 계산
    const now = new Date();
    const startDate = new Date(now);
    switch (period) {
        case "1m": startDate.setMonth(now.getMonth() - 1); break;
        case "3m": startDate.setMonth(now.getMonth() - 3); break;
        case "6m": startDate.setMonth(now.getMonth() - 6); break;
        case "1y": startDate.setFullYear(now.getFullYear() - 1); break;
        case "all": startDate.setFullYear(2019, 8, 13); break;
        default: startDate.setMonth(now.getMonth() - 3);
    }

    const startDateStr = startDate.toISOString().split("T")[0];

    try {
        // 1. OI 데이터 조회
        const { data: oiData, error: oiError } = await supabase
            .from("open_interest_history")
            .select("date, oi_value, oi_coins")
            .eq("symbol", symbol)
            .gte("date", startDateStr)
            .order("date", { ascending: true });

        if (oiError) throw oiError;
        if (!oiData || oiData.length === 0) {
            return NextResponse.json({ symbol, period, count: 0, data: [] });
        }

        // 2. OI 데이터의 첫 날짜 기준으로 BTC 가격 조회
        //    candle_start_at은 UTC 타임스탬프이므로 날짜 비교를 위해 date() 캐스팅
        const oiFirstDate = oiData[0].date; // "YYYY-MM-DD"

        const { data: priceData, error: priceError } = await supabase
            .from("btc_ohlc")
            .select("candle_start_at, close")
            .gte("candle_start_at", `${oiFirstDate}T00:00:00.000Z`)
            .order("candle_start_at", { ascending: true });

        if (priceError) throw priceError;

        // 3. BTC 가격을 날짜(YYYY-MM-DD) 기준 Map으로 변환
        const priceMap = new Map<string, number>();
        for (const row of priceData ?? []) {
            const dateKey = row.candle_start_at.split("T")[0]; // UTC 날짜만 추출
            priceMap.set(dateKey, parseFloat(row.close));
        }

        // 4. OI 데이터에 BTC 가격 매칭
        //    가격이 없는 날짜는 btc_price: null로 반환 (차트에서 건너뜀)
        const merged = oiData.map((d) => ({
            date: d.date,
            oi_value: d.oi_value,
            oi_coins: d.oi_coins,
            btc_price: priceMap.get(d.date) ?? null,
        }));

        return NextResponse.json({
            symbol,
            period,
            count: merged.length,
            data: merged,
        });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}