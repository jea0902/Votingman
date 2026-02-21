/**
 * 보팅맨 소개 플레이스홀더
 * - 추후 팀·비전·연혁 등으로 확장
 */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
        보팅맨 소개
      </h1>
      <p className="mt-4 text-muted-foreground">
        투명한 재무 데이터로 검증한 투자 전략 플랫폼입니다. 자세한 소개가 곧
        공개됩니다.
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
