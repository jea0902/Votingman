/**
 * btc_1d 무효 처리된 폴의 sentiment_votes bet_amount 초기화 (1회성)
 * 실행: node scripts/fix-btc1d-votes-reset.mjs
 * 필요: .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local)");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data: polls, error: pollErr } = await admin
    .from("sentiment_polls")
    .select("id, market, candle_start_at")
    .eq("market", "btc_1d")
    .not("settled_at", "is", null)
    .order("candle_start_at", { ascending: false })
    .limit(5);

  if (pollErr || !polls?.length) {
    console.log("대상 폴 없음 또는 조회 실패:", pollErr?.message ?? "empty");
    return;
  }

  for (const poll of polls) {
    const { data: votes, error: vErr } = await admin
      .from("sentiment_votes")
      .select("id, user_id, bet_amount")
      .eq("poll_id", poll.id)
      .gt("bet_amount", 0);

    if (vErr || !votes?.length) continue;

    const { error: updErr } = await admin
      .from("sentiment_votes")
      .update({ bet_amount: 0 })
      .eq("poll_id", poll.id)
      .gt("bet_amount", 0);

    if (updErr) {
      console.error("업데이트 실패:", poll.id, updErr.message);
    } else {
      console.log("초기화 완료:", poll.candle_start_at, votes.length, "건");
    }
  }
}

main().catch(console.error);
