import { NextResponse } from "next/server";

type RateKey = "us" | "kr" | "de" | "jp";

type InterestRateRow = {
  key: RateKey;
  label: string;
  value: number | null;
  changePct: number | null;
};

const TV_SYMBOLS: Array<{ key: RateKey; label: string; symbol: string }> = [
  { key: "us", label: "미국 10년물", symbol: "TVC-US10Y" },
  { key: "kr", label: "한국 10년물", symbol: "TVC-KR10Y" },
  { key: "de", label: "유럽 10년물", symbol: "TVC-DE10Y" },
  { key: "jp", label: "일본 10년물", symbol: "TVC-JP10Y" },
];

function parseTradingViewYield(html: string): { value: number | null; changePct: number | null } {
  // Examples:
  // "The current yield rate is 4.261% — it's increased by 2.43% over the past week."
  const valueMatch = html.match(/current yield rate is\s+([0-9]+(?:\.[0-9]+)?)%/i);
  const value = valueMatch ? Number(valueMatch[1]) : null;

  const changeMatch = html.match(/(?:it's\s*)?(increased|decreased)\s+by\s+([0-9]+(?:\.[0-9]+)?)%/i);
  const changePct =
    changeMatch && changeMatch[1] && changeMatch[2]
      ? (changeMatch[1].toLowerCase() === "decreased" ? -1 : 1) * Number(changeMatch[2])
      : null;

  return {
    value: Number.isFinite(value as number) ? value : null,
    changePct: Number.isFinite(changePct as number) ? changePct : null,
  };
}

async function fetchYield(symbol: string): Promise<{ value: number | null; changePct: number | null }> {
  try {
    const url = `https://www.tradingview.com/symbols/${encodeURIComponent(symbol)}/`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return { value: null, changePct: null };
    const html = await res.text();
    return parseTradingViewYield(html);
  } catch {
    return { value: null, changePct: null };
  }
}

export async function GET() {
  try {
    const rows = await Promise.all(
      TV_SYMBOLS.map(async (t) => ({
        key: t.key,
        label: t.label,
        ...(await fetchYield(t.symbol)),
      }))
    );

    const data: InterestRateRow[] = rows;
    return NextResponse.json({
      success: true,
      data,
      meta: { updatedAt: Date.now(), source: "tradingview-symbol-page" },
    });
  } catch (error) {
    console.error("[market/interest-rates-10y] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTEREST_RATES_FETCH_FAILED", message: "금리 정보를 불러오지 못했습니다." },
      },
      { status: 500 }
    );
  }
}

