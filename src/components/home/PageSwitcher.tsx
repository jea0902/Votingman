"use client";

/**
 * 루트(/) 페이지: 비로그인 → 랜딩, 로그인 → 홈
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LandingSection } from "@/components/landing/LandingSection";
import { HomeContent } from "@/components/home/HomeContent";

export function PageSwitcher() {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s as { user: { id: string } } | null);
      setIsLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s as { user: { id: string } } | null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
      </div>
    );
  }

  return session?.user ? <HomeContent /> : <LandingSection />;
}
