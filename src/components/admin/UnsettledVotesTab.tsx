"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Database, Loader2 } from "lucide-react";

const REFRESH_INTERVAL_MS = 60_000;

interface UnsettledPoll {
  id: string;
  poll_date: string;
  market: string | null;
  candle_start_at: string;
  long_count: number;
  short_count: number;
  total_coin: number;
  vote_count: number;
  created_at: string;
}

interface AggregateResetItem {
  id: string;
  poll_date: string;
  market: string | null;
  candle_start_at: string;
  total_coin: number;
}

const MARKET_FILTERS = [
  { value: "btc", label: "비트코인" },
  { value: "kospi_1d", label: "1일 후 코스피" },
  { value: "kospi_4h", label: "4시간 후 코스피" },
  { value: "kosdaq_1d", label: "1일 후 코스닥" },
  { value: "kosdaq_4h", label: "4시간 후 코스닥" },
  { value: "samsung_1d", label: "1일 후 삼성전자" },
  { value: "samsung_1h", label: "1시간 후 삼성전자" },
  { value: "skhynix_1d", label: "1일 후 SK하이닉스" },
  { value: "skhynix_1h", label: "1시간 후 SK하이닉스" },
  { value: "hyundai_1d", label: "1일 후 현대자동차" },
  { value: "hyundai_1h", label: "1시간 후 현대자동차" },
  { value: "ndq_1d", label: "1일 후 나스닥" },
  { value: "ndq_4h", label: "4시간 후 나스닥" },
  { value: "sp500_1d", label: "1일 후 SPX" },
  { value: "sp500_4h", label: "4시간 후 SPX" },
  { value: "dow_jones_1d", label: "1일 후 다우존스" },
  { value: "dow_jones_4h", label: "4시간 후 다우존스" },
  { value: "wti_1d", label: "1일 후 WTI" },
  { value: "wti_4h", label: "4시간 후 WTI" },
  { value: "xau_1d", label: "1일 후 금현물" },
  { value: "xau_4h", label: "4시간 후 금현물" },
  { value: "shanghai_1d", label: "1일 후 상해종합" },
  { value: "shanghai_4h", label: "4시간 후 상해종합" },
  { value: "nikkei_1d", label: "1일 후 니케이225" },
  { value: "nikkei_4h", label: "4시간 후 니케이225" },
  { value: "eurostoxx50_1d", label: "1일 후 유로스톡스50" },
  { value: "eurostoxx50_4h", label: "4시간 후 유로스톡스50" },
  { value: "hang_seng_1d", label: "1일 후 항셍" },
  { value: "hang_seng_4h", label: "4시간 후 항셍" },
  { value: "usd_krw_1d", label: "1일 후 USD/KRW" },
  { value: "usd_krw_4h", label: "4시간 후 USD/KRW" },
  { value: "jpy_krw_1d", label: "1일 후 JPY/KRW" },
  { value: "jpy_krw_4h", label: "4시간 후 JPY/KRW" },
  { value: "usd10y_1d", label: "1일 후 미국 10년물" },
  { value: "usd10y_4h", label: "4시간 후 미국 10년물" },
  { value: "usd30y_1d", label: "1일 후 미국 30년물" },
  { value: "usd30y_4h", label: "4시간 후 미국 30년물" },
  { value: "eth_1d", label: "1일 후 ETH" },
  { value: "eth_4h", label: "4시간 후 ETH" },
  { value: "eth_1h", label: "1시간 후 ETH" },
  { value: "eth_15m", label: "15분 후 ETH" },
  { value: "eth_5m", label: "5분 후 ETH" },
  { value: "usdt_1d", label: "1일 후 USDT" },
  { value: "usdt_4h", label: "4시간 후 USDT" },
  { value: "usdt_1h", label: "1시간 후 USDT" },
  { value: "usdt_15m", label: "15분 후 USDT" },
  { value: "usdt_5m", label: "5분 후 USDT" },
  { value: "xrp_1d", label: "1일 후 XRP" },
  { value: "xrp_4h", label: "4시간 후 XRP" },
  { value: "xrp_1h", label: "1시간 후 XRP" },
  { value: "xrp_15m", label: "15분 후 XRP" },
  { value: "xrp_5m", label: "5분 후 XRP" },
] as const;

export function UnsettledVotesTab() {
  const [unsettledPolls, setUnsettledPolls] = useState<UnsettledPoll[]>([]);
  const [aggregateResetNeeded, setAggregateResetNeeded] = useState<AggregateResetItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resetSelectedIds, setResetSelectedIds] = useState<Set<string>>(new Set());
  const [marketFilter, setMarketFilter] = useState<string>("btc");
  const [isInvalidating, setIsInvalidating] = useState(false);
  const [invalidateMessage, setInvalidateMessage] = useState<string | null>(null);

  const fetchUnsettledPolls = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/unsettled-polls?market=${encodeURIComponent(marketFilter)}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        setUnsettledPolls(json.data.polls ?? []);
        setAggregateResetNeeded(json.data.aggregate_reset_needed ?? []);
      } else {
        setUnsettledPolls([]);
        setAggregateResetNeeded([]);
      }
    } catch {
      setUnsettledPolls([]);
      setAggregateResetNeeded([]);
    }
  }, [marketFilter]);

  useEffect(() => {
    fetchUnsettledPolls();
    const id = setInterval(fetchUnsettledPolls, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchUnsettledPolls]);

  useEffect(() => {
    setSelectedIds(new Set());
    setResetSelectedIds(new Set());
  }, [marketFilter]);

  const toggleResetSelect = useCallback((id: string) => {
    setResetSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(unsettledPolls.map((p) => p.id));
      return new Set([...prev].filter((id) => valid.has(id)));
    });
  }, [unsettledPolls]);

  useEffect(() => {
    setResetSelectedIds((prev) => {
      const valid = new Set(aggregateResetNeeded.map((p) => p.id));
      return new Set([...prev].filter((id) => valid.has(id)));
    });
  }, [aggregateResetNeeded]);

  const handleInvalidateSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}건을 무효 처리하시겠습니까?\n배팅된 금액은 전원 원금 환불되고, 베팅·참여 수가 0으로 초기화됩니다.`)) return;

    setIsInvalidating(true);
    setInvalidateMessage(null);
    try {
      const res = await fetch("/api/admin/invalidate-polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollIds: ids }),
      });
      const json = await res.json();

      if (json.success) {
        setInvalidateMessage(json.data?.message ?? "무효 처리 완료");
        setSelectedIds(new Set());
        await fetchUnsettledPolls();
      } else {
        setInvalidateMessage(json?.error?.message ?? "실패");
      }
    } catch {
      setInvalidateMessage("요청 실패");
    } finally {
      setIsInvalidating(false);
    }
  }, [selectedIds, fetchUnsettledPolls]);

  const handleBackfillAndSettle = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (
      !confirm(
        `선택한 ${ids.length}건을 백필 후 정산하시겠습니까?\n(Binance에서 OHLC 수집 후 정상 정산. btc_1d/4h/1h/15m만 지원)`
      )
    )
      return;

    setIsInvalidating(true);
    setInvalidateMessage(null);
    try {
      const res = await fetch("/api/admin/backfill-and-settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollIds: ids }),
      });
      const json = await res.json();

      if (json.success) {
        setInvalidateMessage(json.data?.message ?? "백필 후 정산 완료");
        setSelectedIds(new Set());
        await fetchUnsettledPolls();
      } else {
        setInvalidateMessage(json?.error?.message ?? "실패");
      }
    } catch {
      setInvalidateMessage("요청 실패");
    } finally {
      setIsInvalidating(false);
    }
  }, [selectedIds, fetchUnsettledPolls]);

  const handleResetAggregates = useCallback(async () => {
    const ids = Array.from(resetSelectedIds);
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}건의 집계를 0으로 초기화하시겠습니까?\n(이미 무효 처리된 폴의 표시를 새 투표지처럼 맞춤)`)) return;

    setIsInvalidating(true);
    setInvalidateMessage(null);
    try {
      const res = await fetch("/api/admin/invalidate-polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollIds: ids }),
      });
      const json = await res.json();

      if (json.success) {
        setInvalidateMessage("집계 초기화 완료");
        setResetSelectedIds(new Set());
        await fetchUnsettledPolls();
      } else {
        setInvalidateMessage(json?.error?.message ?? "실패");
      }
    } catch {
      setInvalidateMessage("요청 실패");
    } finally {
      setIsInvalidating(false);
    }
  }, [resetSelectedIds, fetchUnsettledPolls]);

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          미정산 투표 처리
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          시장별 가장 최근 미정산 폴만 표시. 백필 후 정산(권장) 또는 무효 처리.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {MARKET_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={marketFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setMarketFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {unsettledPolls.length === 0 ? (
          <p className="text-sm text-muted-foreground">미정산 폴 없음</p>
        ) : (
          <>
            <div className="rounded border border-border p-2 text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="w-10 py-1 pr-1"></th>
                    <th className="py-1 pr-2">시장</th>
                    <th className="py-1 pr-2">캔들</th>
                    <th className="py-1 pr-2">투표</th>
                    <th className="py-1">총 코인</th>
                  </tr>
                </thead>
                <tbody>
                  {unsettledPolls.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-1 pr-1">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                      <td className="py-1 pr-2 font-medium">{p.market ?? "-"}</td>
                      <td className="py-1 pr-2 text-muted-foreground">
                        {p.candle_start_at?.slice(0, 16) ?? "-"}
                      </td>
                      <td className="py-1 pr-2">{p.vote_count}명</td>
                      <td className="py-1">{p.total_coin.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleBackfillAndSettle}
                disabled={isInvalidating || selectedIds.size === 0}
              >
                {isInvalidating ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 shrink-0" />
                )}
                <span className="ml-2">
                  {isInvalidating
                    ? "처리 중..."
                    : `백필 후 정산 (${selectedIds.size}건)`}
                </span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleInvalidateSelected}
                disabled={isInvalidating || selectedIds.size === 0}
              >
                {isInvalidating ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span className="ml-2">
                  {isInvalidating
                    ? "처리 중..."
                    : `무효 처리 (${selectedIds.size}건)`}
                </span>
              </Button>
            </div>
          </>
        )}
        {aggregateResetNeeded.length > 0 && (
          <>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-500">
              집계 초기화 필요 (이미 무효 처리됐지만 베팅·참여 수가 0이 아님)
            </p>
            <div className="rounded border border-amber-500/40 p-2 text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="w-10 py-1 pr-1"></th>
                    <th className="py-1 pr-2">시장</th>
                    <th className="py-1 pr-2">캔들</th>
                    <th className="py-1">총 코인</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregateResetNeeded.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-1 pr-1">
                        <input
                          type="checkbox"
                          checked={resetSelectedIds.has(p.id)}
                          onChange={() => toggleResetSelect(p.id)}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                      <td className="py-1 pr-2 font-medium">{p.market ?? "-"}</td>
                      <td className="py-1 pr-2 text-muted-foreground">
                        {p.candle_start_at?.slice(0, 16) ?? "-"}
                      </td>
                      <td className="py-1">{p.total_coin.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAggregates}
              disabled={isInvalidating || resetSelectedIds.size === 0}
            >
              {isInvalidating ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : null}
              <span className={isInvalidating ? "ml-2" : ""}>
                {isInvalidating
                  ? "처리 중..."
                  : `선택한 폴 집계 초기화 (${resetSelectedIds.size}건)`}
              </span>
            </Button>
          </>
        )}
        {invalidateMessage && (
          <p className="text-sm text-muted-foreground">{invalidateMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}
