# btc_ohlc 수집 트러블슈팅

## 데이터가 쌓이지 않을 때 점검 사항

### 1. 수동 호출로 파이프라인 확인

로컬에서 다음을 실행해 **바이낸스 조회 → DB 저장** 전체 흐름이 동작하는지 확인하세요.

```powershell
# .env.local의 CRON_SECRET 사용
$secret = $env:CRON_SECRET
if (-not $secret) { $secret = "test-secret-12345-long-enough" }
$dates = '["2025-02-10","2025-02-11","2025-02-12"]'
$body = "{`"poll_dates`": $dates}"

# 백필 API (과거 날짜 수집)
Invoke-RestMethod -Uri "http://localhost:3000/api/cron/btc-ohlc-backfill" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $secret"; "Content-Type" = "application/json" } `
  -Body $body
```

- `success: true` 및 `total_upserted > 0` 이면 정상
- 401 → `CRON_SECRET` 누락 또는 불일치
- 500 → Binance API 오류 또는 Supabase(btc_ohlc 테이블) 오류

### 2. 체크리스트

| 항목 | 확인 방법 |
|------|-----------|
| **btc_ohlc 테이블 존재** | Supabase SQL Editor: `SELECT COUNT(*) FROM btc_ohlc;` |
| **마이그레이션 009 적용** | `docs/migrations/009_btc_ohlc_and_polls_candle_start.sql` 실행 여부 |
| **CRON_SECRET 설정** | Vercel 대시보드 → Settings → Environment Variables |
| **Supabase 환경변수** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (서버용) |
| **Vercel 플랜** | Hobby: **하루 1회만** 실행 가능. 15m/1h/4h 크론은 Pro 필요 |

### 3. Vercel Hobby 플랜 제한

Hobby 플랜에서는 **크론이 하루 1회만** 실행됩니다.  
`vercel.json`에 15m, 1h, 4h 크론이 있으면 배포 시 오류가 나거나 해당 크론이 무시될 수 있습니다.

- **Hobby**: `btc-ohlc-daily`만 사용 (`schedule: "1 15 * * *"` = 매일 KST 00:01)
- **Pro**: 15m, 1h, 4h, daily 모두 사용 가능

### 4. 15m 크론 스케줄 오류

기존 `"5 0,15,30,45 * * *"`에서 `0,15,30,45`는 **시(hour)** 필드인데, 30과 45는 잘못된 값(0–23)입니다.  
15분마다 돌리려면 **분(minute)** 필드를 사용해야 합니다. → `vercel.json` 수정됨.

### 5. 즉시 데이터 채우기 (백필)

```powershell
# 최근 7일치 수동 수집
$body = '{"poll_dates":["2025-02-07","2025-02-08","2025-02-09","2025-02-10","2025-02-11","2025-02-12","2025-02-13"]}'
Invoke-RestMethod -Uri "https://YOUR_DOMAIN.vercel.app/api/cron/btc-ohlc-backfill" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer YOUR_CRON_SECRET"; "Content-Type" = "application/json" } `
  -Body $body
```

날짜를 오늘 이전으로 바꿔서 실행하세요.
