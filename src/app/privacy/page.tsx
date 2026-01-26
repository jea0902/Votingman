/**
 * 개인정보처리방침 플레이스홀더
 */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
        개인정보처리방침
      </h1>
      <p className="mt-4 text-muted-foreground">
        개인정보처리방침이 곧 게시됩니다.
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
