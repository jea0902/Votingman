"use client";

/**
 * HeartbeatProvider — 로그인 유저의 last_active_at 주기적 갱신
 *
 * 설계 의도:
 * - 마운트 시 1회 + 60초마다 POST /api/heartbeat 호출
 * - 로그인 상태에서만 동작
 */
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL_MS = 60_000;

export function HeartbeatProvider() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const runHeartbeat = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      try {
        await fetch("/api/heartbeat", { method: "POST" });
      } catch {
        // 조용히 실패 (재시도는 다음 주기에)
      }
    };

    runHeartbeat();
    intervalRef.current = setInterval(runHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return null;
}
