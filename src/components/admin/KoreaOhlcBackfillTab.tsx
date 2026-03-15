"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const KOREA_MARKETS = [
  { id: "kospi_1d", label: "코스피 1일봉" },
  { id: "kospi_1h", label: "코스피 1시간봉" },
  { id: "kosdaq_1d", label: "코스닥 1일봉" },
  { id: "kosdaq_1h", label: "코스닥 1시간봉" },
  { id: "samsung_1d", label: "삼성전자 1일봉" },
  { id: "samsung_1h", label: "삼성전자 1시간봉" },
  { id: "skhynix_1d", label: "SK하이닉스 1일봉" },
  { id: "skhynix_1h", label: "SK하이닉스 1시간봉" },
  { id: "hyundai_1d", label: "현대자동차 1일봉" },
  { id: "hyundai_1h", label: "현대자동차 1시간봉" },
] as const;

const COIN_MARKETS = [
  { id: "btc_1d", label: "BTC 1일봉" },
  { id: "btc_4h", label: "BTC 4시간봉" },
  { id: "btc_1h", label: "BTC 1시간봉" },
  { id: "btc_15m", label: "BTC 15분봉" },
  { id: "btc_5m", label: "BTC 5분봉" },
  { id: "eth_1d", label: "ETH 1일봉" },
  { id: "eth_4h", label: "ETH 4시간봉" },
  { id: "eth_1h", label: "ETH 1시간봉" },
  { id: "eth_15m", label: "ETH 15분봉" },
  { id: "eth_5m", label: "ETH 5분봉" },
  { id: "xrp_1d", label: "XRP 1일봉" },
  { id: "xrp_4h", label: "XRP 4시간봉" },
  { id: "xrp_1h", label: "XRP 1시간봉" },
  { id: "xrp_15m", label: "XRP 15분봉" },
  { id: "xrp_5m", label: "XRP 5분봉" },
] as const;

type KoreaMarketId = (typeof KOREA_MARKETS)[number]["id"];
type CoinMarketId = (typeof COIN_MARKETS)[number]["id"];
type BackfillKind = "korea" | "coin";

export function KoreaOhlcBackfillTab() {
  const [kind, setKind] = useState<BackfillKind>("korea");
  const [market, setMarket] = useState<KoreaMarketId | CoinMarketId>("kospi_1d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const endpoint =
        kind === "korea"
          ? "/api/admin/korea-ohlc-backfill"
          : "/api/admin/coin-ohlc-backfill";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ market, from, to }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        const msg =
          json?.error?.message ??
          json?.error ??
          "백필 요청 중 오류가 발생했습니다.";
        setError(msg);
      } else {
        const data = json.data ?? {};
        const msg =
          data.message ??
          `백필 완료: upserted=${data.upserted ?? "?"}, total_in_range=${data.total_in_range ?? "?"}`;
        setResult(msg);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "백필 요청 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">OHLC 백필</h2>
      <p className="text-sm text-muted-foreground">
        코인 시장(Binance 기반) 또는 한국 지수(Yahoo Finance 기반)의 과거 OHLC를 강제로
        백필합니다. 크론/네트워크 이슈 등으로 누락된 구간을 복구할 때 사용하세요.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setKind("coin");
              setMarket("btc_1d");
            }}
            className={cn(
              "rounded border px-3 py-1 text-sm",
              kind === "coin"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-foreground hover:bg-muted"
            )}
          >
            코인 시장
          </button>
          <button
            type="button"
            onClick={() => {
              setKind("korea");
              setMarket("kospi_1d");
            }}
            className={cn(
              "rounded border px-3 py-1 text-sm",
              kind === "korea"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-foreground hover:bg-muted"
            )}
          >
            한국 시장
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(kind === "korea" ? KOREA_MARKETS : COIN_MARKETS).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMarket(m.id)}
              className={cn(
                "rounded border px-3 py-1 text-sm",
                market === m.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:bg-muted"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <label className="block text-xs text-muted-foreground" htmlFor="from">
              From (YYYY-MM-DD)
            </label>
            <input
              id="from"
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded border border-input bg-background px-2 text-sm"
              placeholder="2025-01-01"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-muted-foreground" htmlFor="to">
              To (YYYY-MM-DD)
            </label>
            <input
              id="to"
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded border border-input bg-background px-2 text-sm"
              placeholder="2025-03-31"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "inline-flex items-center rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
            isLoading && "opacity-70"
          )}
        >
          {isLoading ? "백필 중..." : "백필 실행"}
        </button>
      </form>

      {result && (
        <div className="rounded border border-emerald-500/50 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600">
          {result}
        </div>
      )}
      {error && (
        <div className="rounded border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

