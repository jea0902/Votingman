/**
 * 시장별 가격 표시 소수점 자리
 * - XRP ~$1대: 4자리
 * - BTC/ETH 등: 2자리
 * - 한국 지수(코스피/코스닥): 2자리 (포인트)
 * - 한국 개별 주식: 0자리 (원화)
 */

/** 한국 지수(코스피·코스닥): 목표가/현재가를 포인트 형식(통화 기호 없음) */
const KOREA_INDEX_PREFIXES = ["kospi_", "kosdaq_"] as const;

/** 한국 개별 주식(삼성전자 등): 목표가/현재가를 원화(KRW) 형식 */
const KOREA_STOCK_PREFIXES = ["samsung_", "skhynix_", "hyundai_"] as const;

export type KoreanPriceDisplayKind = "point" | "krw" | null;

/**
 * 한국 주식 시장만의 가격 표시 형식.
 * - 지수(코스피, 코스닥): "point" → 숫자만 (예: 2,750.00)
 * - 개별 주식(삼성전자 등): "krw" → 원화 (예: ₩75,000)
 * - 그 외: null → 달러($) 사용
 */
export function getKoreanPriceDisplayKind(market: string): KoreanPriceDisplayKind {
  if (KOREA_INDEX_PREFIXES.some((p) => market.startsWith(p))) return "point";
  if (KOREA_STOCK_PREFIXES.some((p) => market.startsWith(p))) return "krw";
  return null;
}

export function getPriceFractionDigits(market: string): number {
  if (getKoreanPriceDisplayKind(market) === "krw") return 0;
  if (getKoreanPriceDisplayKind(market) === "point") return 2;
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

const FIXED_LOCALE = "en-US";

/**
 * 목표가(시가)·현재가 표시용. 한국 지수=포인트, 한국 개별주식=KRW, 그 외=$
 */
export function formatMarketPrice(
  price: number | null,
  market: string
): string {
  if (price == null || !Number.isFinite(price)) return "—";
  const kind = getKoreanPriceDisplayKind(market);
  const digits = getPriceFractionDigits(market);
  const numStr = price.toLocaleString(FIXED_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (kind === "point") return numStr;
  if (kind === "krw") return `₩${numStr}`;
  return `$${numStr}`;
}
