// =============================================
// 4시간봉 빠른 백필 (Node.js)
// =============================================

const CRON_SECRET = "9nysIzkyOPR3WkhAmyelqF6RjAR9MXAn5AvCxITzW5Y=";
const DOMAIN = "https://www.votingman.com";

async function backfillDays() {
  const dates = [
    "2026-03-04",
    "2026-03-03", 
    "2026-03-02",
    "2026-03-01",
    "2026-02-28"
  ];
  
  console.log("🔥 4시간봉 빠른 백필 시작...");
  
  for (const date of dates) {
    console.log(`📊 ${date} 수집 중...`);
    
    try {
      const response = await fetch(`${DOMAIN}/api/cron/btc-ohlc-backfill`, {
        method: 'POST',
        headers: {
          'x-cron-secret': CRON_SECRET,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          poll_dates: [date],
          markets: ["btc_4h"]
        })
      });
      
      const result = await response.json();
      console.log(`✅ ${date}: ${JSON.stringify(result.data || result)}`);
      
    } catch (error) {
      console.log(`❌ ${date}: ${error.message}`);
    }
    
    // 1초 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("🎉 백필 완료!");
}

backfillDays();