"use client";

/**
 * 루트(/) 페이지: 비로그인 → 랜딩, 로그인 → 홈
 * 세션은 동적 import로 나중에 확인해 초기 번들/실행을 가볍게 함.
 */

import { useEffect, useState } from "react";
import { LandingSection } from "@/components/landing/LandingSection";
import { HomeContent } from "@/components/home/HomeContent";

export function PageSwitcher() {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    import("@/lib/supabase/client").then(({ createClient }) => {
      if (cancelled) return;
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (cancelled) return;
        setSession(s as { user: { id: string } } | null);
        setChecked(true);
      });
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, s) => {
        if (!cancelled) setSession(s as { user: { id: string } } | null);
      });
      unsub = () => subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  if (!checked) {
    return <LandingSection />;
  }
  return session?.user ? <HomeContent /> : <LandingSection />;
}
