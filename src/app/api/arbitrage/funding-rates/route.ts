import { NextResponse } from "next/server";
import { FUNDING_DISPLAY_THRESHOLD } from "@/lib/arbitrage/funding-display";

/**
 * 펀딩비 아비트라지 데이터 API
 *
 * 숏 거래소 (5개): 바이낸스, 바이비트, OKX, 비트겟, 하이퍼리퀴드
 * 현물 거래소 (4개): 바이낸스, 바이비트, OKX, 비트겟 (유동성 검증된 곳만)
 *
 * 로직:
 *   1. 5개 거래소 선물 펀딩비 fetch + 4개 거래소 현물 마켓 목록 fetch (병렬)
 *   2. 바이낸스 거래량 기준 상위 200개 종목으로 제한
 *   3. 종목별로 선물 측 최적 거래소 + 현물 상장 거래소 조합 계산
 *      - 양펀딩 ≥ 0.1%: 선물 숏 + 현물 매수 (펀딩 최고 거래소)
 *      - 음펀딩 ≤ -0.1%: 선물 롱 + 현물 매도(숏) — 펀딩이 가장 낮은(가장 음수) 거래소
 *   4. 일 APR(수취 기준) 높은 순 정렬
 */

// ────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────

export type ExchangeName = "binance" | "bybit" | "okx" | "bitget" | "hyperliquid" | "gateio" | "mexc";
export type SpotExchangeName = "binance" | "bybit" | "okx" | "bitget";
// 선물 전용 거래소 (현물 거래소로 사용 불가)
export type FuturesOnlyExchangeName = "hyperliquid" | "gateio" | "mexc";

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

    // 최적 조합 (양펀: 숏 선물 / 음펀: 롱 선물)
    futuresPosition: "short" | "long";
    bestFuturesExchange: ExchangeName;
    bestFuturesRate: number;
    spotExchanges: SpotExchangeName[];  // 현물 상장된 거래소 목록

    // 수익 지표
    dailyApr: number;                   // 일 환산 APR (%) — 펀딩 수취 규모(항상 ≥ 0 표시)
    intervalHours: number;              // 정산 주기
}

export { FUNDING_DISPLAY_THRESHOLD } from "@/lib/arbitrage/funding-display";

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
    // fundingInfo: 종목별 정산 주기 실시간 감지 (극단 시 1h/4h로 단축되는 경우 반영)
    const [fundingRes, tickerRes, fundingInfoRes] = await Promise.all([
        fetch("https://fapi.binance.com/fapi/v1/premiumIndex"),
        fetch("https://fapi.binance.com/fapi/v1/ticker/24hr"),
        fetch("https://fapi.binance.com/fapi/v1/fundingInfo"),
    ]);
    const fundingData = await fundingRes.json();
    const tickerData = await tickerRes.json();
    const fundingInfoData = await fundingInfoRes.json();

    // 종목별 정산 주기 Map (fundingIntervalHours 필드)
    const intervalMap = new Map<string, number>();
    for (const f of fundingInfoData ?? []) {
        if (!f.symbol.endsWith("USDT")) continue;
        const base = f.symbol.replace("USDT", "");
        intervalMap.set(base, f.fundingIntervalHours ?? 8);
    }

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
            intervalHours: intervalMap.get(base) ?? 8, // 실시간 정산 주기
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

/** 바이비트 선물 instruments-info에서 종목별 정산 주기 가져오기
 *  fundingInterval: 분 단위 (480 = 8시간, 60 = 1시간)
 */
async function fetchBybitFundingIntervalMap(): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    let cursor = "";
    while (true) {
        const url = `https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000${cursor ? `&cursor=${cursor}` : ""}`;
        const res = await fetch(url, { next: { revalidate: 3600 } });
        const data = await res.json();
        for (const s of data.result?.list ?? []) {
            if (!s.symbol.endsWith("USDT")) continue;
            const base = s.symbol.replace("USDT", "");
            // fundingInterval: 분 단위 → 시간으로 변환
            const intervalMin = parseInt(s.fundingInterval ?? "480");
            map.set(base, intervalMin / 60);
        }
        cursor = data.result?.nextPageCursor ?? "";
        if (!cursor) break;
    }
    return map;
}

async function fetchBybitFunding(): Promise<Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>> {
    // tickers + instruments-info 병렬 호출
    const [tickerData, intervalMap] = await Promise.all([
        fetch("https://api.bybit.com/v5/market/tickers?category=linear").then((r) => r.json()),
        fetchBybitFundingIntervalMap(),
    ]);
    const map = new Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>();
    for (const d of tickerData.result?.list ?? []) {
        if (!d.symbol.endsWith("USDT")) continue;
        const base = d.symbol.replace("USDT", "");
        map.set(base, {
            rate: parseFloat(d.fundingRate ?? "0"),
            nextFundingTime: parseInt(d.nextFundingTime ?? "0"),
            intervalHours: intervalMap.get(base) ?? 8, // 실시간 정산 주기
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
            // fundingInterval: 초 단위 (28800 = 8시간, 3600 = 1시간)
            const intervalSec = parseInt(d.fundingInterval ?? "28800");
            map.set(base, {
                rate: parseFloat(d.fundingRate ?? "0"),
                nextFundingTime: parseInt(d.nextFundingTime ?? "0"),
                intervalHours: intervalSec / 3600, // 실시간 정산 주기
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
        // fundingInterval: ms 단위 (28800000 = 8시간, 3600000 = 1시간)
        const intervalMs = parseInt(d.fundingInterval ?? "28800000");
        map.set(base, {
            rate: parseFloat(d.fundingRate ?? "0"),
            nextFundingTime: parseInt(d.deliveryTime ?? "0"),
            intervalHours: intervalMs / 3_600_000, // 실시간 정산 주기
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
// 게이트io (선물 전용)
// ────────────────────────────────────────────────

async function fetchGateioFunding(): Promise<Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>> {
    const res = await fetch("https://api.gateio.ws/api/v4/futures/usdt/tickers");
    const data = await res.json();
    const map = new Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>();
    for (const d of data ?? []) {
        // 게이트io 심볼 형태: "BTC_USDT"
        if (!d.contract.endsWith("_USDT")) continue;
        const base = d.contract.replace("_USDT", "");
        map.set(base, {
            rate: parseFloat(d.funding_rate ?? "0"),
            nextFundingTime: parseInt(d.funding_next_apply ?? "0") * 1000, // 초 → ms
            intervalHours: 8,
        });
    }
    return map;
}

// ────────────────────────────────────────────────
// MEXC (선물 전용)
// ────────────────────────────────────────────────

async function fetchMexcFunding(): Promise<Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>> {
    const res = await fetch("https://contract.mexc.com/api/v1/contract/ticker");
    const data = await res.json();
    const map = new Map<string, { rate: number; nextFundingTime: number; intervalHours: number }>();
    for (const d of data.data ?? []) {
        // MEXC 심볼 형태: "BTC_USDT"
        if (!d.symbol.endsWith("_USDT")) continue;
        const base = d.symbol.replace("_USDT", "");
        map.set(base, {
            rate: parseFloat(d.fundingRate ?? "0"),
            nextFundingTime: parseInt(d.nextSettleTime ?? "0"),
            intervalHours: 8,
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
            gateioFunding, mexcFunding,
        ] = await Promise.all([
            fetchBinanceSpotSymbols(),
            fetchBybitSpotSymbols(),
            fetchOkxSpotSymbols(),
            fetchBitgetSpotSymbols(),
            fetchBinanceFunding(),
            fetchBybitFunding(),
            fetchBitgetFunding(),
            fetchHyperliquidFunding(),
            fetchGateioFunding(),
            fetchMexcFunding(),
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
            const gateioData = gateioFunding.get(symbol);
            const mexcData = mexcFunding.get(symbol);

            const funding: Record<ExchangeName, ExchangeFundingData | null> = {
                binance: binanceData ? { rate: binanceData.rate, intervalHours: binanceData.intervalHours, nextFundingTime: binanceData.nextFundingTime } : null,
                bybit: bybitData ? { rate: bybitData.rate, intervalHours: bybitData.intervalHours, nextFundingTime: bybitData.nextFundingTime } : null,
                okx: okxData ? { rate: okxData.rate, intervalHours: okxData.intervalHours, nextFundingTime: okxData.nextFundingTime } : null,
                bitget: bitgetData ? { rate: bitgetData.rate, intervalHours: bitgetData.intervalHours, nextFundingTime: bitgetData.nextFundingTime } : null,
                hyperliquid: hlData ? { rate: hlData.rate, intervalHours: hlData.intervalHours, nextFundingTime: hlData.nextFundingTime } : null,
                gateio: gateioData ? { rate: gateioData.rate, intervalHours: gateioData.intervalHours, nextFundingTime: gateioData.nextFundingTime } : null,
                mexc: mexcData ? { rate: mexcData.rate, intervalHours: mexcData.intervalHours, nextFundingTime: mexcData.nextFundingTime } : null,
            };

            // gateio/mexc/hl: 선물 전용 — 아래 루프에서 현물 없으면 제외하는 조건은
            // 이미 spotExchanges.length >= 1 일 때만 행을 만들므로 사실상 항상 통과
            const FUTURES_ONLY: ExchangeName[] = ["hyperliquid", "gateio", "mexc"];
            const shortCandidates: { exchange: ExchangeName; rate: number; intervalHours: number }[] = [];
            const longCandidates: { exchange: ExchangeName; rate: number; intervalHours: number }[] = [];

            for (const [ex, data] of Object.entries(funding) as [ExchangeName, ExchangeFundingData | null][]) {
                if (!data || data.rate === null) continue;
                if (FUTURES_ONLY.includes(ex as ExchangeName) && spotExchanges.length === 0) continue;

                if (data.rate >= FUNDING_DISPLAY_THRESHOLD) {
                    shortCandidates.push({
                        exchange: ex,
                        rate: data.rate,
                        intervalHours: data.intervalHours ?? 8,
                    });
                }
                if (data.rate <= -FUNDING_DISPLAY_THRESHOLD) {
                    longCandidates.push({
                        exchange: ex,
                        rate: data.rate,
                        intervalHours: data.intervalHours ?? 8,
                    });
                }
            }

            if (shortCandidates.length === 0 && longCandidates.length === 0) continue;

            let futuresPosition: "short" | "long";
            let bestExchange: ExchangeName;
            let bestRate: number;
            let intervalHours: number;

            if (shortCandidates.length > 0 && longCandidates.length > 0) {
                shortCandidates.sort((a, b) => b.rate - a.rate);
                longCandidates.sort((a, b) => a.rate - b.rate);
                const s = shortCandidates[0];
                const l = longCandidates[0];
                const aprShort = calcDailyApr(s.rate, s.intervalHours);
                const aprLong = calcDailyApr(-l.rate, l.intervalHours);
                if (aprShort >= aprLong) {
                    futuresPosition = "short";
                    bestExchange = s.exchange;
                    bestRate = s.rate;
                    intervalHours = s.intervalHours;
                } else {
                    futuresPosition = "long";
                    bestExchange = l.exchange;
                    bestRate = l.rate;
                    intervalHours = l.intervalHours;
                }
            } else if (shortCandidates.length > 0) {
                shortCandidates.sort((a, b) => b.rate - a.rate);
                const s = shortCandidates[0];
                futuresPosition = "short";
                bestExchange = s.exchange;
                bestRate = s.rate;
                intervalHours = s.intervalHours;
            } else {
                longCandidates.sort((a, b) => a.rate - b.rate);
                const l = longCandidates[0]!;
                futuresPosition = "long";
                bestExchange = l.exchange;
                bestRate = l.rate;
                intervalHours = l.intervalHours;
            }

            const dailyApr =
                futuresPosition === "short"
                    ? calcDailyApr(bestRate, intervalHours)
                    : calcDailyApr(-bestRate, intervalHours);

            rows.push({
                symbol,
                funding,
                spotAvailable,
                futuresPosition,
                bestFuturesExchange: bestExchange,
                bestFuturesRate: bestRate,
                spotExchanges,
                dailyApr,
                intervalHours,
            });
        }

        // 5. 정렬 우선순위
        //    1) 양수 펀딩(숏 전략) 우선
        //    2) 같은 전략 내에서는 펀딩 수취 APR 높은 순
        rows.sort((a, b) => {
            if (a.futuresPosition !== b.futuresPosition) {
                return a.futuresPosition === "short" ? -1 : 1;
            }
            return b.dailyApr - a.dailyApr;
        });

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