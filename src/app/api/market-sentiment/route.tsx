import { NextRequest, NextResponse } from "next/server";

/**
 * 바이낸스 공식 API - 시장 분위기 데이터
 *
 * 제공 데이터:
 * - 롱/숏 비율 (전체 유저)
 * - 고래 롱/숏 비율 (상위 트레이더)
 * - 테이커 롱/숏 비율 (실제 시장가 체결 방향)
 * - 펀딩 비율 (BTC, ETH, XRP) - 펀딩비율: premiumIndex로 교체 (실시간 예상 펀딩률)
 * - 최근 대형 청산 내역
 * - BTC/ETH 현재가 추가 (테이커 거래량 달러 환산용)
 *
 * 모두 바이낸스 공식 API, API 키 불필요
 */

const BINANCE_FAPI = "https://fapi.binance.com";

async function fetchBinance(path: string) {
  const res = await fetch(`${BINANCE_FAPI}${path}`, {
    next: { revalidate: 30 }, // 30초 캐시
  });
  if (!res.ok) throw new Error(`Binance API error: ${path} ${res.status}`);
  return res.json();
}

export async function GET(request: NextRequest) {
  try {
    const [
      btcLongShort, ethLongShort,
      btcWhale, ethWhale,
      btcTaker, ethTaker,
      btcPremium, ethPremium, xrpPremium,
      btcLiquidations,
      btcPrice, ethPrice,
    ] = await Promise.allSettled([
      // 전체 유저 롱/숏 비율
      fetchBinance("/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1"),
      fetchBinance("/futures/data/globalLongShortAccountRatio?symbol=ETHUSDT&period=5m&limit=1"),
      // 고래(상위 트레이더) 롱/숏 비율
      fetchBinance("/futures/data/topLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1"),
      fetchBinance("/futures/data/topLongShortAccountRatio?symbol=ETHUSDT&period=5m&limit=1"),
      // 테이커 롱/숏 비율 (실제 시장가 체결)
      fetchBinance("/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=5m&limit=1"),
      fetchBinance("/futures/data/takerlongshortRatio?symbol=ETHUSDT&period=5m&limit=1"),
// 실시간 예상 펀딩률 (nextFundingTime, lastFundingRate 포함)
fetchBinance("/fapi/v1/premiumIndex?symbol=BTCUSDT"),
fetchBinance("/fapi/v1/premiumIndex?symbol=ETHUSDT"),
fetchBinance("/fapi/v1/premiumIndex?symbol=XRPUSDT"),
      // 최근 청산 내역 (BTC)
      fetchBinance("/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=20"),
            // 현재가 (테이커 거래량 달러 환산용)
            fetchBinance("/fapi/v1/ticker/price?symbol=BTCUSDT"),
            fetchBinance("/fapi/v1/ticker/price?symbol=ETHUSDT"),
    ]);

    const getValue = (result: PromiseSettledResult<any>, index = 0) =>
      result.status === "fulfilled" ? result.value?.[index] ?? null : null;
    const getSingle = (result: PromiseSettledResult<any>) =>
      result.status === "fulfilled" ? result.value : null;

    return NextResponse.json({
      longShort: { btc: getValue(btcLongShort), eth: getValue(ethLongShort) },
      whale: { btc: getValue(btcWhale), eth: getValue(ethWhale) },
      taker: { btc: getValue(btcTaker), eth: getValue(ethTaker) },
      funding: {
        btc: getSingle(btcPremium),
        eth: getSingle(ethPremium),
        xrp: getSingle(xrpPremium),
      },
      liquidations: btcLiquidations.status === "fulfilled" ? btcLiquidations.value : [],
      prices: {
        btc: getSingle(btcPrice)?.price ?? null,
        eth: getSingle(ethPrice)?.price ?? null,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Market sentiment API error:", err);
    return NextResponse.json(
      { error: "시장 데이터를 불러오는 데 실패했습니다." },
      { status: 500 }
    );
  }
}