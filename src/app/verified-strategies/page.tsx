/**
 * 검증된 매매법 페이지
 *
 * 설계 의도:
 * - 서비스 준비중 안내 페이지
 * - 일관된 UI/UX 제공
 */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function VerifiedStrategiesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
        검증된 매매법
      </h1>
      <p className="mt-4 text-muted-foreground">
        검증된 매매법 서비스가 곧 공개됩니다.
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
