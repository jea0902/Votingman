# 크론(Cron) 설정 가이드 — 매일 시가·종가 자동 기록

## 질문에 대한 답변

### 1. 바이낸스 API로 가격 조회 후 DB 저장 프로세스는 이미 구현되어 있나요?

**예, 이미 구현되어 있습니다.**

| 단계 | 구현 위치 | 설명 |
|------|-----------|------|
| 가격 조회 | `src/lib/binance/btc-kst.ts` | `fetchBtcOpenCloseKst(poll_date)` — Binance 공개 API로 해당일 시가·종가 조회 |
| DB 저장 | `src/lib/sentiment/settlement-service.ts` | `updateBtcOhlcForPoll(poll_date, poll_id)` — 조회한 시가·종가를 `sentiment_polls` 행에 반영 |
| 한 번에 실행 | `src/app/api/cron/btc-ohlc-daily/route.ts` | 위 두 가지를 “어제 폴” / “오늘 폴”에 대해 순서대로 호출 (폴 없으면 생성 후 갱신) |

즉, **“바이낸스 조회 → DB 저장” 전체 흐름은 이미 코드에 들어 있고**, 크론이 할 일은 **이 API를 매일 정해진 시각에 한 번 호출**하는 것뿐입니다.

---

### 2. 그럼 크론으로 자동화만 하면 되나요?

**예. “자동화만” 하면 됩니다.**

- 할 일: **매일 KST 09:00**에 `GET /api/cron/btc-ohlc-daily` 를 **한 번 호출**해 주면 됩니다. (1d 봉 UTC 00:00 마감 직후)
- 그 API가 내부에서 어제/오늘 폴 생성·갱신과 시가·종가 조회·저장까지 모두 수행합니다.
- 별도로 “새로 구현”할 프로세스는 없고, **호출을 예약하는 방법**만 정하면 됩니다.

---

### 3. 크론을 써본 적이 없을 때 — 구체적으로 어떻게 하면 되나요?

아래는 **Vercel에 배포한 경우** 기준으로, “크론으로 자동화”만 하기 위한 **최소 단계**입니다.

---

## 방법 A: Vercel Cron 사용 (같은 프로젝트에서 자동 실행)

프로젝트를 **Vercel**에 배포했다면, Vercel이 제공하는 Cron만 써서 자동화할 수 있습니다.  
> **참고**: 현재 btc_1d는 **cron-job.org**로 매일 09:00 KST에 호출 중입니다. Vercel Cron은 Pro 플랜 이상에서만 동작합니다.  
> 기존에는 `vercel.json`에 “매일 15:01 UTC (= KST 00:01)”에 `/api/cron/btc-ohlc-daily` 를 부르도록 설정해 두었습니다.

### 1단계: 비밀 값(CRON_SECRET) 만들기

- 터미널에서 한 번만 실행해서 랜덤 문자열을 만듭니다.
  ```bash
  # Windows (PowerShell)
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

  # 또는 Mac/Linux
  openssl rand -hex 32
  ```
- 나온 문자열을 복사해 둡니다 (예: `a1b2c3d4e5...`). **이걸 아무한테도 공개하지 마세요.**

### 2단계: Vercel에 환경 변수 넣기

1. [Vercel 대시보드](https://vercel.com) 로그인 후, 해당 **프로젝트** 선택.
2. 상단 메뉴에서 **Settings** → 왼쪽에서 **Environment Variables**.
3. **Add New** 클릭.
4. 다음처럼 입력:
   - **Key**: `CRON_SECRET`
   - **Value**: 1단계에서 복사한 문자열
   - **Environment**: Production (그리고 필요하면 Preview 등도 선택)
5. **Save** 클릭.

이렇게 하면, Vercel이 **Cron으로 이 API를 호출할 때** 자동으로 `Authorization: Bearer <CRON_SECRET>` 를 붙여 줍니다.  
우리 API는 이 값을 검사해서 “Cron에서 온 호출”인지 확인합니다.

### 3단계: 배포하기

- **방법 1**: Git에 푸시하면 Vercel이 자동 배포합니다. (`vercel.json` 포함되어 있으면 Cron도 함께 등록됩니다.)
- **방법 2**: Vercel CLI로 배포:
  ```bash
  vercel --prod
  ```

배포가 끝나면, **매일 KST 00:01**에 Vercel이 `/api/cron/btc-ohlc-daily` 를 호출하고, 그때마다 바이낸스 조회 + DB 저장이 자동으로 실행됩니다.

### 4단계: 동작 확인 (선택)

- **수동 호출로 테스트**  
  터미널에서 (프로덕션 URL과 2단계에서 넣은 비밀 값 사용):
  ```bash
  curl -X GET "https://여기에는-실제-도메인.vercel.app/api/cron/btc-ohlc-daily" -H "Authorization: Bearer 여기에_CRON_SECRET_값"
  ```
  응답에 `"success": true` 와 `results` 가 나오면, “조회 + 저장”이 정상 동작한 것입니다.
- **실제 Cron 실행 로그**  
  Vercel 대시보드 → 프로젝트 → **Logs** 또는 **Deployments** → 해당 배포의 **Functions** 탭에서, 00:01 KST 근처에 `/api/cron/btc-ohlc-daily` 호출이 찍히는지 확인할 수 있습니다.

---

## 방법 B: 외부 스케줄러 사용 (Vercel Cron 말고 다른 서비스)

Vercel Cron을 쓰지 않고, **cron-job.org** 같은 외부 서비스로 “매일 같은 시각에 우리 API를 호출”하게 할 수도 있습니다.

### 1단계: CRON_SECRET 정하기

- 방법 A의 1단계처럼 랜덤 문자열을 하나 만들고, **Vercel 환경 변수**에 `CRON_SECRET` 으로 넣어 둡니다 (위 2단계와 동일).

### 2단계: cron-job.org에서 작업 만들기

1. [cron-job.org](https://cron-job.org) 에서 계정 만들고 로그인.
2. **Create cron job** 선택.
3. 다음처럼 설정:
   - **Title**: 예) `BTC OHLC daily`
   - **URL**: `https://여기에는-실제-도메인.vercel.app/api/cron/btc-ohlc-daily`
   - **Schedule**: 매일 00:01 — 시간대를 **Korean Time (KST, UTC+9)** 로 두고, `00:01` 로 설정.
   - **Request method**: GET
   - **Request headers** 에서 “Add header”:
     - Name: `Authorization`
     - Value: `Bearer 여기에_CRON_SECRET_값`
4. 저장 후 활성화.

이후에는 매일 KST 00:01에 이 서비스가 위 URL을 GET으로 호출하고, 우리 API가 그때마다 바이낸스 조회 + DB 저장을 수행합니다.

---

## 지금 당장 크론 동작 테스트 + DB 확인

### 1) CRON_SECRET 로컬에 넣기

- 프로젝트 루트의 `.env.local` 파일을 열고 다음 한 줄을 추가합니다 (이미 있으면 수정).
  ```env
  CRON_SECRET=아무거나_긴_비밀문자_32자이상
  ```
- 테스트용이라면 예: `CRON_SECRET=test-secret-12345-long-enough` 처럼 아무 값이나 32자 이상 넣어도 됩니다. **배포 환경에서는 반드시 랜덤한 강한 비밀값을 쓰세요.**

### 2) 로컬 서버 실행

- 터미널에서:
  ```bash
  npm run dev
  ```
- `http://localhost:3000` (또는 표시된 포트)에서 서버가 떠 있는지 확인합니다.

### 3) 크론 API 수동 호출 (일일 job과 동일한 동작)

- **PowerShell**에서 (한 줄로):
  ```powershell
  curl.exe -X GET "http://localhost:3000/api/cron/btc-ohlc-daily" -H "Authorization: Bearer test-secret-12345-long-enough"
  ```
  - `.env.local`에 넣은 `CRON_SECRET` 값과 `Bearer ` 뒤 문자열을 **동일하게** 맞추세요.
- **성공 시** 응답 예:
  ```json
  {
    "success": true,
    "data": {
      "message": "BTC OHLC daily cron completed",
      "kst_today": "2025-02-06",
      "results": [
        { "date": "2025-02-05", "btc_open": 12345.67, "btc_close": 67890.12, "poll_created": false },
        { "date": "2025-02-06", "btc_open": 67890.12, "btc_close": null, "poll_created": false }
      ]
    }
  }
  ```
- `"success": true` 이고 `results` 안에 `btc_open` / `btc_close` 숫자가 보이면, **바이낸스 조회 → DB 저장**이 정상 동작한 것입니다.

### 4) DB에서 확인

1. **Supabase** 대시보드 → **Table Editor** → `sentiment_polls` 테이블 선택.
2. **필터**: `market` = `btc`, `poll_date`가 **어제·오늘** (예: 2025-02-05, 2025-02-06) 인 행을 봅니다.
3. 해당 행의 **btc_open**, **btc_close** 컬럼에 값이 들어가 있으면 크론 로직이 DB까지 잘 반영된 것입니다. (오늘 날짜는 `btc_close`가 아직 null일 수 있습니다.)

---

## 2월 4일·5일·6일 데이터 일괄 넣기 (백필)

특정 과거 날짜(예: 2/4, 2/5, 2/6)에 대해 **폴이 없으면 만들고**, 해당일 비트코인 시가·종가를 **한 번에** DB에 넣으려면 **백필 API**를 사용합니다.

### 1) CRON_SECRET 준비

- 위 “지금 당장 테스트”와 같이 `.env.local`에 `CRON_SECRET`이 있어야 합니다. 로컬 서버는 `npm run dev` 로 띄워 둡니다.

### 2) 백필 API 호출

- **PowerShell**에서 (두 줄: JSON 변수 넣고 호출):
  ```powershell
  $body = '{"poll_dates": ["2025-02-04", "2025-02-05", "2025-02-06"]}'
  curl.exe -X POST "http://localhost:3000/api/cron/btc-ohlc-backfill" -H "Authorization: Bearer test-secret-12345-long-enough" -H "Content-Type: application/json" -d $body
  ```
  - `Bearer ` 뒤는 본인 `.env.local`의 `CRON_SECRET` 값으로 바꾸세요.
  - `poll_dates` 배열에 원하는 날짜를 더 넣어도 됩니다 (형식: `YYYY-MM-DD`).
- **한 줄로** 보내려면:
  ```powershell
  curl.exe -X POST "http://localhost:3000/api/cron/btc-ohlc-backfill" -H "Authorization: Bearer test-secret-12345-long-enough" -H "Content-Type: application/json" -d "{`"poll_dates`": [`"2025-02-04`", `"2025-02-05`", `"2025-02-06`"]}"
  ```
  (PowerShell에서는 따옴표 escape에 백틱 `` ` `` 사용.)

- **성공 시** 응답 예:
  ```json
  {
    "success": true,
    "data": {
      "message": "BTC OHLC backfill completed",
      "count": 3,
      "results": [
        { "poll_date": "2025-02-04", "btc_open": ..., "btc_close": ..., "poll_created": true },
        { "poll_date": "2025-02-05", "btc_open": ..., "btc_close": ..., "poll_created": true },
        { "poll_date": "2025-02-06", "btc_open": ..., "btc_close": ..., "poll_created": true }
      ]
    }
  }
  ```

### 3) DB에서 백필 결과 확인

- Supabase → **Table Editor** → `sentiment_polls`
- `market` = `btc`, `poll_date` IN (2025-02-04, 2025-02-05, 2025-02-06) 인 행을 확인합니다.
- 각 행에 **btc_open**, **btc_close**가 채워져 있으면 2/4, 2/5, 2/6 데이터가 모두 들어간 것입니다.

### 4) 배포 환경에서 백필할 때

- URL만 프로덕션으로 바꾸고, Vercel에 설정한 **CRON_SECRET** 값을 사용하면 됩니다.
  ```powershell
  $body = '{"poll_dates": ["2025-02-04", "2025-02-05", "2025-02-06"]}'
  curl.exe -X POST "https://본인-도메인.vercel.app/api/cron/btc-ohlc-backfill" -H "Authorization: Bearer 여기에_Vercel에_넣은_CRON_SECRET" -H "Content-Type: application/json" -d $body
  ```

---

## 정리

| 질문 | 답 |
|------|----|
| 바이낸스 조회 + DB 저장 프로세스가 이미 구현되어 있나요? | **예.** `btc-kst.ts` + `updateBtcOhlcForPoll` + `/api/cron/btc-ohlc-daily` 에 모두 들어 있습니다. |
| 그럼 크론으로 자동화만 하면 되나요? | **예.** 매일 00:01 KST에 위 API만 호출되면 됩니다. |
| 크론을 처음 쓸 때 구체적으로 어떻게 하나요? | **Vercel 사용 시**: `CRON_SECRET` 환경 변수 설정 → 배포 → 끝. (자세한 단계는 위 “방법 A” 참고.) |

추가로 궁금한 점이 있으면, “지금 Vercel에 배포했는지 / 다른 호스팅인지”만 알려주시면 그 환경에 맞춰 더 구체적으로 적어 드리겠습니다.
