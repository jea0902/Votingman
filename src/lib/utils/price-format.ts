/**
 * 시장별 가격 표시 소수점 자리
 * - XRP ~$1대: 4자리
 * - BTC/ETH 등: 2자리
 */

export function getPriceFractionDigits(market: string): number {
  return market.startsWith("xrp_") ? 4 : 2;
}

export function formatPrice(price: number | null, market: string): string {
  if (price == null || !Number.isFinite(price)) return "—";
  const digits = getPriceFractionDigits(market);
  return price.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
