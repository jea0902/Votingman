"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Loader2, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RewardClaim {
  id: string;
  user_id: string;
  period: string;
  rank: number | null;
  phone_number: string;
  privacy_consent: boolean;
  paid_at: string | null;
  created_at: string;
  nickname: string;
  created_at_kst: string;
  paid_at_kst: string;
}

const START_YEAR = 2026;
const START_MONTH = 3;

function getDefaultPeriod(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  if (y < START_YEAR || (y === START_YEAR && m < START_MONTH)) {
    return `${START_YEAR}-${String(START_MONTH).padStart(2, "0")}`;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function buildPeriodOptions(): { year: number; month: number }[] {
  const now = new Date();
  const endY = now.getFullYear();
  const endM = now.getMonth() + 1;
  const options: { year: number; month: number }[] = [];
  for (let y = START_YEAR; y <= endY; y++) {
    const startM = y === START_YEAR ? START_MONTH : 1;
    const lastM = y === endY ? endM : 12;
    for (let m = startM; m <= lastM; m++) {
      options.push({ year: y, month: m });
    }
  }
  return options.reverse();
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  return phone;
}

export function MonthlyRewardsTab() {
  const [period, setPeriod] = useState(getDefaultPeriod);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reward-claims?period=${encodeURIComponent(period)}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error?.message ?? "조회에 실패했습니다.");
        setClaims([]);
        return;
      }

      if (json.success && json.data?.claims) {
        setClaims(json.data.claims);
      } else {
        setClaims([]);
      }
    } catch {
      setError("서버와 통신할 수 없습니다.");
      setClaims([]);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleMarkPaid = useCallback(
    async (id: string) => {
      if (!confirm("이 건을 지급 완료 처리하시겠습니까?")) return;

      setPayingId(id);
      setMessage(null);
      try {
        const res = await fetch("/api/admin/reward-claims", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, paid: true }),
        });
        const json = await res.json();

        if (json.success) {
          setMessage("지급 완료 처리되었습니다.");
          await fetchClaims();
        } else {
          setMessage(json?.error?.message ?? "처리 실패");
        }
      } catch {
        setMessage("요청 실패");
      } finally {
        setPayingId(null);
      }
    },
    [fetchClaims]
  );

  const periodOptions = buildPeriodOptions();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="h-5 w-5 text-muted-foreground" />
          월별 보상 (TOP 10 선물하기 3만원권)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          월별 보상 신청 목록. 지급 완료 시 paid_at 업데이트.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">대상 월:</span>
          <div className="flex items-center gap-2">
            <select
              value={period.split("-")[0]}
              onChange={(e) => {
                const y = parseInt(e.target.value, 10);
                const monthsForYear = periodOptions.filter((o) => o.year === y);
                const first = monthsForYear[0];
                if (first) {
                  setPeriod(`${y}-${String(first.month).padStart(2, "0")}`);
                }
              }}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {[...new Set(periodOptions.map((o) => o.year))].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              value={period.split("-")[1]}
              onChange={(e) => {
                const m = e.target.value;
                const [y] = period.split("-");
                setPeriod(`${y}-${m}`);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {periodOptions
                .filter((o) => o.year === parseInt(period.split("-")[0], 10))
                .map((o) => ({
                  m: String(o.month).padStart(2, "0"),
                  label: `${o.month}월`,
                }))
                .map(({ m, label }) => (
                  <option key={m} value={m}>
                    {label}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={fetchClaims} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 shrink-0", isLoading && "animate-spin")} />
          새로고침
        </Button>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">조회 중...</span>
          </div>
        ) : claims.length === 0 ? (
          <p className="text-sm text-muted-foreground">해당 월 보상 신청 없음</p>
        ) : (
          <div className="rounded border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2">순위</th>
                  <th className="px-3 py-2">닉네임</th>
                  <th className="px-3 py-2">휴대폰</th>
                  <th className="px-3 py-2">신청일시 (KST)</th>
                  <th className="px-3 py-2">지급</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{c.rank ?? "-"}위</td>
                    <td className="px-3 py-2 font-medium">{c.nickname}</td>
                    <td className="px-3 py-2 font-mono">{formatPhone(c.phone_number)}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {c.created_at_kst ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      {c.paid_at ? (
                        <span className="text-green-600 dark:text-green-400" title={c.paid_at_kst}>
                          완료
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={payingId === c.id}
                          onClick={() => handleMarkPaid(c.id)}
                        >
                          {payingId === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          <span className="ml-1">지급 완료</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
