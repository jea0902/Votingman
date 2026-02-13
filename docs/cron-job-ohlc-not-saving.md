# cron-job.org로 15m/1h/4h 수집 시 btc_ohlc에 안 쌓일 때

## 1. 확인할 것 (순서대로)

### 1) cron-job.org 실행 결과
- **Cronjobs** → 해당 job **HISTORY** 클릭
- 각 실행의 **HTTP 상태 코드**와 **응답 본문** 확인
  - **401**: 인증 실패 → `x-cron-secret` 헤더 값이 Vercel의 `CRON_SECRET`과 동일한지 확인
  - **500**: 서버 에러 → 응답 body에 `error: "..."` 문자열이 있으면 그게 원인. Vercel Logs에서도 동일 메시지 확인
  - **200**: 성공이면 `data.upserted`, `data.total_fetched` 확인
    - `total_fetched: 0` → Binance에서 데이터를 못 가져온 것 (예: 예전 배포에서 451 발생)
    - `total_fetched > 0` 인데 `upserted: 0` → DB upsert 문제 가능 (아래 2·3 확인)

### 2) Vercel 환경 변수
- **Settings → Environment Variables**
- **Production**에 다음이 있는지 확인
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- cron은 프로덕션 URL로 호출되므로, 이 둘이 없으면 Supabase insert/upsert에서 실패할 수 있음

### 3) Supabase에 btc_ohlc 테이블 존재 여부
- Supabase 대시보드 → **Table Editor** (또는 SQL)에서 `btc_ohlc` 테이블이 있는지 확인
- 없으면 `docs/migrations/009_btc_ohlc_and_polls_candle_start.sql` 내용을 Supabase SQL Editor에서 실행해 테이블 생성

### 4) 최신 배포 여부
- 15m/1h/4h는 **data-api.binance.vision** 사용하도록 수정된 코드가 배포되어 있어야 함 (451 방지)
- 오래된 배포면 Binance에서 데이터를 못 받아 `total_fetched: 0`이 될 수 있음 → 최신 커밋으로 다시 배포

## 2. 수동으로 한 번 호출해 보기

로컬 또는 프로덕션 URL로 직접 호출해서 응답 확인:

```powershell
$headers = @{ "x-cron-secret" = "여기에_Vercel에_설정한_CRON_SECRET" }
Invoke-WebRequest -Uri "https://www.votingman.com/api/cron/btc-ohlc-15m" -Method GET -Headers $headers -UseBasicParsing
```

- **200**이고 body에 `total_fetched: 8`, `upserted: 8` 비슷하게 나오면 → 정상 동작. cron-job.org 설정(URL/헤더)만 다시 확인
- **401** → 헤더의 시크릿 값이 Vercel `CRON_SECRET`과 다름
- **500** → body의 `error` 문자열과 Vercel Logs를 보고 원인 처리

## 3. 정리

| 현상 | 가능 원인 |
|------|------------|
| 401 | cron-job.org에 `x-cron-secret` (또는 `Authorization: Bearer <CRON_SECRET>`) 미설정 또는 값 불일치 |
| 500 | Supabase 키/URL 없음, 테이블 없음, Binance 에러 등 → 응답 body·Vercel Logs 확인 |
| 200인데 DB에 없음 | `total_fetched: 0`이면 Binance 쪽(또는 구 배포). `upserted > 0`인데 안 보이면 다른 DB/프로젝트를 보고 있거나 캐시 가능성 |
