import { NextResponse } from "next/server";

/**
 * 펀딩비 아비트라지 데이터 API
 *
 * 숏 거래소 (5개): 바이낸스, 바이비트, OKX, 비트겟, 하이퍼리퀴드
 * 현물 거래소 (4개): 바이낸스, 바이비트, OKX, 비트겟 (유동성 검증된 곳만)
 *
 * 로직:
 *   1. 5개 거래소 선물 펀딩비 fetch + 4개 거래소 현물 마켓 목록 fetch (병렬)
 *   2. 바이낸스 거래량 기준 상위 200개 종목으로 제한
 *   3. 종목별로 "숏 거래소(펀딩비 최고) + 현물 거래소(상장된 곳)" 최적 조합 계산
 *   4. 양펀비 높은 순 정렬
 */

// ────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────

export type ExchangeName = "binance" | "bybit" | "okx" | "bitget" | "hyperliquid";
export type SpotExchangeName = "binance" | "bybit" | "okx" | "bitget";

export interface ExchangeFundingData {
    rate: number | null;            // 펀딩비 (소수, 예: 0.0001 = 0.01%)
    intervalHours: number | null;   // 정산 주기 (시간)
    nextFundingTime: number | null; // 다음 정산 시각 (ms)
}

export interface SpotAvailability {
    binance: boolean;
    bybit: boolean;
    okx: boolean;
    bitget: boolean;
}

export interface FundingRateRow {
    symbol: string;                 // 예: "BTC"

    // 거래소별 선물 펀딩비 (하이퍼리퀴드 포함)
    funding: Record<ExchangeName, ExchangeFundingData | null>;

    // 현물 상장 여부 (4개 CEX만)
    spotAvailable: SpotAvailability;

    // 최적 조합
    bestShortExchange: ExchangeName;    // 펀딩비 가장 높은 숏 거래소
    bestShortRate: number;              // 해당 펀딩비
    spotExchanges: SpotExchangeName[];  // 현물 상장된 거래소 목록

    // 수익 지표
    dailyApr: number;                   // 일 환산 APR (%)
    intervalHours: number;              // 정산 주기
}

// ────────────────────────────────────────────────
// 바이낸스
// ────────────────────────────────────────────────

async function fetchBinanceSpotSymbols(): Promise<Set<string>> {
    const res = await fetch("https://api.binance.com/api/v3/exchangeInfo", {
        next: { revalidate: 3600 },
    });
    const data = await res.json();
    const symbols = new Set<string>();
    for (const s of data.symbols ?? []) {
        if (s.quoteAsset === "USDT" && s.status === "TRADING") {
            symbols.add(s.baseAsset);
        }
    }
    return symbols;
}

async function fetchBinanceFunding(): Promise<Map<string, { rate: number; nextFundingTime: number; quoteVolume: number; intervalHours: number }>> {
    const [fundingRes, tickerRes] = await Promise.all([
        fetch("https://fapi.binance.com/fapi/v1/premiumIndex"),
        fetch("https://fapi.binance.com/fapi/v1/ticker/24hr"),
    ]);
    const fundingData = await fundingRes.json();
    const tickerData = await tickerRes.json();

    const volumeMap = new Map<string, number>();
    for (const t of tickerData) {
        if (t.symbol.endsWith("USDT")) {
            volumeMap.set(t.symbol, parseFloat(t.quoteVolume));
        }
    }

    const map = new Map<string, { rate: number; nextFundingTime: number; quoteVolume: number; intervalHours: number }>();
    for (const d of fundingData) {
        if (!d.symbol.endsWith("USDT")) continue;
        const base = d.symbol.replace("USDT", "");
        map.set(base, {
            rate: parseFloat(d.lastFundingRate),
            nextFundingTime: d.nextFundingTime,
            quoteVolume: volumeMap.get(d.symbol) ?? 0,
            intervalHours: 8,
        });
    }
    return map;
}

// ────────────────────────────────────────────────
// 바이비트
// ────────────────────────────────────────────────

async function fetchBybitSpotSymbols(): Promise<Set<string>> {
    const res = await fetch(
        "https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000",
        { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const symbols = new Set<string>();
    for (const s of data.result?.list ?? []) {
        if (s.quoteCoin === "USDT" && s.status === "Trading") {
            symbols.add(s.baseCoin);
        }
    }
    return symbols;
}

async function fetchBybitFunding(): Promise<Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>> {
    const res = await fetch("https://api.bybit.com/v5/market/tickers?category=linear");
    const data = await res.json();
    const map = new Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>();
    for (const d of data.result?.list ?? []) {
        if (!d.symbol.endsWith("USDT")) continue;
        const base = d.symbol.replace("USDT", "");
        map.set(base, {
            rate: parseFloat(d.fundingRate ?? "0"),
            nextFundingTime: parseInt(d.nextFundingTime ?? "0"),
            intervalHours: 8,
        });
    }
    return map;
}

// ────────────────────────────────────────────────
// OKX
// ────────────────────────────────────────────────

async function fetchOkxSpotSymbols(): Promise<Set<string>> {
    const res = await fetch(
        "https://www.okx.com/api/v5/public/instruments?instType=SPOT",
        { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const symbols = new Set<string>();
    for (const s of data.data ?? []) {
        if (s.quoteCcy === "USDT" && s.state === "live") {
            symbols.add(s.baseCcy);
        }
    }
    return symbols;
}

async function fetchOkxFunding(): Promise<Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>> {
    // OKX tickers에 펀딩비 포함
    const res = await fetch("https://www.okx.com/api/v5/market/tickers?instType=SWAP");
    const data = await res.json();
    const map = new Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>();
    for (const d of data.data ?? []) {
        if (!d.instId.endsWith("USDT-SWAP")) continue;
        const base = d.instId.replace("-USDT-SWAP", "");
        // OKX tickers에는 fundingRate 없음 → 개별 호출 필요하지만
        // top200만 대상으로 하므로 일단 0으로 세팅 후 별도 배치 호출
        map.set(base, {
            rate: parseFloat(d.fundingRate ?? "0"),
            nextFundingTime: parseInt(d.nextFundingTime ?? "0"),
            intervalHours: 8,
        });
    }
    return map;
}

/**
 * OKX는 tickers에 펀딩비가 없어서 심볼 목록 확보 후
 * /public/funding-rate 를 배치로 호출
 */
async function fetchOkxFundingBatch(symbols: string[]): Promise<Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>> {
    const map = new Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>();

    // 병렬로 최대 20개씩 나눠서 호출
    const BATCH = 20;
    for (let i = 0; i < symbols.length; i += BATCH) {
        const batch = symbols.slice(i, i + BATCH);
        const results = await Promise.allSettled(
            batch.map((sym) =>
                fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${sym}-USDT-SWAP`)
                    .then((r) => r.json())
            )
        );
        for (let j = 0; j < results.length; j++) {
            const result = results[j];
            if (result.status !== "fulfilled") continue;
            const d = result.value.data?.[0];
            if (!d) continue;
            const base = batch[j];
            map.set(base, {
                rate: parseFloat(d.fundingRate ?? "0"),
                nextFundingTime: parseInt(d.nextFundingTime ?? "0"),
                intervalHours: 8,
            });
        }
    }
    return map;
}

// ────────────────────────────────────────────────
// 비트겟
// ────────────────────────────────────────────────

async function fetchBitgetSpotSymbols(): Promise<Set<string>> {
    const res = await fetch(
        "https://api.bitget.com/api/v2/spot/public/symbols",
        { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const symbols = new Set<string>();
    for (const s of data.data ?? []) {
        if (s.quoteCoin === "USDT" && s.status === "online") {
            symbols.add(s.baseCoin);
        }
    }
    return symbols;
}

async function fetchBitgetFunding(): Promise<Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>> {
    const res = await fetch(
        "https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES"
    );
    const data = await res.json();
    const map = new Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>();
    for (const d of data.data ?? []) {
        if (!d.symbol.endsWith("USDT")) continue;
        const base = d.symbol.replace("USDT", "");
        map.set(base, {
            rate: parseFloat(d.fundingRate ?? "0"),
            nextFundingTime: parseInt(d.deliveryTime ?? "0"),
            intervalHours: 8,
        });
    }
    return map;
}

// ────────────────────────────────────────────────
// 하이퍼리퀴드 (선물 전용)
// ────────────────────────────────────────────────

async function fetchHyperliquidFunding(): Promise<Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>> {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    const data = await res.json();
    const map = new Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>();

    const universe: any[] = data[0]?.universe ?? [];
    const assetCtxs: any[] = data[1] ?? [];

    for (let i = 0; i < universe.length; i++) {
        const meta = universe[i];
        const ctx = assetCtxs[i];
        if (!meta || !ctx) continue;

        const symbol = meta.name; // "BTC", "ETH" 등
        const rate = parseFloat(ctx.funding ?? "0");

        // 하이퍼리퀴드는 1시간마다 정산
        map.set(symbol, {
            rate,
            nextFundingTime: 0, // 별도 계산 필요
            intervalHours: 1,
        });
    }
    return map;
}

// ────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────

function calcDailyApr(rate: number, intervalHours: number): number {
    const timesPerDay = 24 / intervalHours;
    return rate * timesPerDay * 100; // % 단위
}

// ────────────────────────────────────────────────
// GET handler
// ────────────────────────────────────────────────

export async function GET() {
    try {
        // 1. 현물 목록 + 선물 펀딩비 병렬 fetch
        const [
            binanceSpot, bybitSpot, okxSpot, bitgetSpot,
            binanceFunding, bybitFunding, bitgetFunding, hyperliquidFunding,
        ] = await Promise.all([
            fetchBinanceSpotSymbols(),
            fetchBybitSpotSymbols(),
            fetchOkxSpotSymbols(),
            fetchBitgetSpotSymbols(),
            fetchBinanceFunding(),
            fetchBybitFunding(),
            fetchBitgetFunding(),
            fetchHyperliquidFunding(),
        ]);

        // 2. 바이낸스 거래량 기준 상위 200개 종목
        const top200 = [...binanceFunding.entries()]
            .sort((a, b) => b[1].quoteVolume - a[1].quoteVolume)
            .slice(0, 200)
            .map(([symbol]) => symbol);

        // 3. OKX 펀딩비 배치 호출 (top200 기준)
        const okxFunding = await fetchOkxFundingBatch(top200);

        // 4. 종목별 최적 조합 계산
        const rows: FundingRateRow[] = [];

        for (const symbol of top200) {
            // 현물 상장 여부
            const spotAvailable: SpotAvailability = {
                binance: binanceSpot.has(symbol),
                bybit: bybitSpot.has(symbol),
                okx: okxSpot.has(symbol),
                bitget: bitgetSpot.has(symbol),
            };

            // 현물 상장된 거래소가 하나도 없으면 스킵
            const spotExchanges = (Object.entries(spotAvailable) as [SpotExchangeName, boolean][])
                .filter(([, v]) => v)
                .map(([k]) => k);
            if (spotExchanges.length === 0) continue;

            // 거래소별 펀딩비 정리
            const binanceData = binanceFunding.get(symbol);
            const bybitData = bybitFunding.get(symbol);
            const okxData = okxFunding.get(symbol);
            const bitgetData = bitgetFunding.get(symbol);
            const hlData = hyperliquidFunding.get(symbol);

            const funding: Record<ExchangeName, ExchangeFundingData | null> = {
                binance: binanceData ? { rate: binanceData.rate, intervalHours: binanceData.intervalHours, nextFundingTime: binanceData.nextFundingTime } : null,
                bybit: bybitData ? { rate: bybitData.rate, intervalHours: bybitData.intervalHours, nextFundingTime: bybitData.nextFundingTime } : null,
                okx: okxData ? { rate: okxData.rate, intervalHours: okxData.intervalHours, nextFundingTime: okxData.nextFundingTime } : null,
                bitget: bitgetData ? { rate: bitgetData.rate, intervalHours: bitgetData.intervalHours, nextFundingTime: bitgetData.nextFundingTime } : null,
                hyperliquid: hlData ? { rate: hlData.rate, intervalHours: hlData.intervalHours, nextFundingTime: hlData.nextFundingTime } : null,
            };

            // 숏 거래소 후보 중 양펀비 최고인 거래소 선택
            const shortCandidates: { exchange: ExchangeName; rate: number; intervalHours: number }[] = [];
            for (const [ex, data] of Object.entries(funding) as [ExchangeName, ExchangeFundingData | null][]) {
                if (data && data.rate !== null && data.rate > 0) {
                    shortCandidates.push({ exchange: ex, rate: data.rate, intervalHours: data.intervalHours ?? 8 });
                }
            }

            if (shortCandidates.length === 0) continue;

            // 펀딩비 가장 높은 숏 거래소
            shortCandidates.sort((a, b) => b.rate - a.rate);
            const best = shortCandidates[0];

            const dailyApr = calcDailyApr(best.rate, best.intervalHours);

            rows.push({
                symbol,
                funding,
                spotAvailable,
                bestShortExchange: best.exchange,
                bestShortRate: best.rate,
                spotExchanges,
                dailyApr,
                intervalHours: best.intervalHours,
            });
        }

        // 5. 양펀비 높은 순 정렬
        rows.sort((a, b) => b.bestShortRate - a.bestShortRate);

        return NextResponse.json({
            updatedAt: Date.now(),
            count: rows.length,
            data: rows,
        });
    } catch (err) {
        console.error("Funding rate fetch error:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}