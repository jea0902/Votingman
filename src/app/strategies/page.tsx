/**
 * 전략 목록 플레이스홀더
 * - 추후 검증된 투자 전략 목록으로 교체
 */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function StrategiesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
        투자 전략
      </h1>
      <p className="mt-4 text-muted-foreground">
        검증된 전략 목록이 곧 공개됩니다.
      </p>
      <Link
        href="/"
        className={cn(buttonVariants({ variant: "outline" }), "mt-8 inline-flex")}
      >
        홈으로
      </Link>
    </div>
  );
}
