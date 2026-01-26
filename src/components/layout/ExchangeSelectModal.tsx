/**
 * 거래소 선택 모달
 *
 * 설계 의도:
 * - 레퍼럴 링크 제공을 위한 거래소 선택 모달
 * - 각 거래소의 Payback/Fee Discount 정보 표시
 * - 선택 후 거래소로 이동하는 기능
 * - 면책 조항 포함
 *
 * 보안: 외부 링크는 새 탭에서 열리며 rel="noopener noreferrer" 적용
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface Exchange {
  id: string;
  name: string;
  logo: string; // 추후 이미지 경로로 교체 가능
  payback?: number;
  feeDiscount?: number;
  url: string;
}

const EXCHANGES: Exchange[] = [
  {
    id: "binance",
    name: "Binance",
    logo: "🔶",
    payback: 20,
    url: "https://www.binance.com",
  },
  {
    id: "okx",
    name: "OKX",
    logo: "⚫",
    payback: 40,
    url: "https://www.okx.com",
  },
  {
    id: "deepcoin",
    name: "Deepcoin",
    logo: "🟠",
    payback: 70,
    feeDiscount: 50,
    url: "https://www.deepcoin.com",
  },
  {
    id: "bitget",
    name: "Bitget",
    logo: "🔵",
    payback: 40,
    feeDiscount: 33,
    url: "https://www.bitget.com",
  },
  {
    id: "gate",
    name: "Gate",
    logo: "🔵",
    payback: 70,
    url: "https://www.gate.io",
  },
  {
    id: "batonex",
    name: "Batonex",
    logo: "🟡",
    url: "https://www.batonex.com",
  },
];

interface ExchangeSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExchangeSelectModal({
  open,
  onOpenChange,
}: ExchangeSelectModalProps) {
  const [selectedExchange, setSelectedExchange] = useState<string>("");

  const handleGoToExchange = () => {
    const exchange = EXCHANGES.find((e) => e.id === selectedExchange);
    if (exchange) {
      window.open(exchange.url, "_blank", "noopener,noreferrer");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Please choose an exchange to trade on.</DialogTitle>
          <DialogDescription className="sr-only">
            거래소를 선택하세요. 각 거래소의 혜택 정보를 확인할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedExchange}
          onValueChange={setSelectedExchange}
          className="space-y-3"
        >
          {EXCHANGES.map((exchange) => (
            <div
              key={exchange.id}
              className={cn(
                "flex items-center justify-between rounded-lg border border-border p-3 transition-colors",
                selectedExchange === exchange.id
                  ? "bg-muted"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl" aria-hidden>
                  {exchange.logo}
                </span>
                <div className="flex-1">
                  <Label
                    htmlFor={exchange.id}
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    {exchange.name}
                  </Label>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {exchange.payback && (
                      <span>{exchange.payback}% Payback</span>
                    )}
                    {exchange.payback && exchange.feeDiscount && (
                      <span> + </span>
                    )}
                    {exchange.feeDiscount && (
                      <span>{exchange.feeDiscount}% Fee Discount</span>
                    )}
                    {!exchange.payback && !exchange.feeDiscount && (
                      <span className="text-muted-foreground/60">
                        No special offer
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <RadioGroupItem value={exchange.id} id={exchange.id} />
            </div>
          ))}
        </RadioGroup>

        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            • This service is provided by Extimit Ltd. and is offered only when
            the customer chooses an exchange.
          </p>
          <p>
            • This service is provided solely at the customer&apos;s request to
            select an exchange, and Extimit Ltd. does not recommend or solicit
            any transactions.
          </p>
          <p>
            • The exchanges available through this service are selected from
            among the global top 10 by trading volume, taking into account
            exchange reliability, and may be subject to change.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGoToExchange}
            disabled={!selectedExchange}
            type="button"
          >
            Go to Exchange
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
