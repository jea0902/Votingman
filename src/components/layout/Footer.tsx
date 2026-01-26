/**
 * Footer – 사이트 하단
 *
 * 설계 의도:
 * - 링크, 저작권 등 공통 푸터. 반응형 그리드/스택.
 * - Deep Dark 테마, 보조 텍스트는 muted-foreground
 */

import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "소개" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
] as const;

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        {/* 로고 + 저작권 */}
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="text-sm font-semibold text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
          >
            Bitcos
          </Link>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Bitcos. 투명한 재무 데이터 기반 투자 전략.
          </p>
        </div>

        {/* 링크 */}
        <nav
          className="flex flex-wrap gap-6 sm:gap-8"
          aria-label="푸터 네비게이션"
        >
          {FOOTER_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
