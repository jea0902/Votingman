# cron-job.org — 버핏 원픽 자동 실행 설정

> **Vercel만 사용 중이라면**: cron-job.org 대신 **GitHub Actions** 사용을 권장합니다.  
> → [docs/github-actions-buffett.md](./github-actions-buffett.md) 참고 (PC/서버 없이 GitHub에서 자동 실행)

버핏 원픽 데이터 수집·평가를 **cron-job.org**에서 URL 호출로 실행하는 방법입니다.

## 전제

- **cron-job.org**는 **HTTP URL을 주기적으로 호출**하는 서비스입니다. 서버에 접속해서 Python을 직접 실행하는 방식이 아닙니다.
- 이 프로젝트에는 다음 **API 라우트**가 있습니다. 이 API가 호출되면 서버에서 `public/scripts` 아래 Python 스크립트를 실행합니다.
  - `GET /api/cron/buffett-prices` → `yf_data_collect.py --mode prices` (오늘 현재가)
  - `GET /api/cron/buffett-result-full` → `yf_result.py --mode full` (평가 실행, 새 run_id)
  - `GET /api/cron/buffett-financials` → `yf_data_collect.py --mode financials` (재무제표, 연 1회)

## 중요: 실행 환경

- **Vercel**에만 배포한 경우: Vercel 서버리스 환경에는 **Python이 없고**, `child_process`로 스크립트를 실행할 수 없습니다.  
  → 위 API는 **Vercel에서는 동작하지 않습니다.**
- **Python이 설치된 서버**에서 Next.js를 실행할 때(예: VPS에서 `npm run build && npm run start`, 또는 별도 Node 서버) 위 API를 사용할 수 있습니다.
- Vercel만 쓰는 경우: 로컬 PC나 VPS에서 **작은 runner 서버**(예: Flask로 “URL 받으면 Python 스크립트 실행”)를 두고, 그 URL을 cron-job.org에 등록하는 방식을 사용해야 합니다.

아래 설정은 **버핏 cron API가 동작하는 서버의 도메인**을 기준으로 합니다.

---

## 1. CRON_SECRET 준비

- 프로젝트에서 쓰는 **CRON_SECRET** 값을 하나 정합니다. (예: `cron-setup-guide.md` 1단계처럼 랜덤 문자열 생성)
- 이 API를 호출하는 **서버**(Next.js가 돌아가는 곳)의 환경 변수에 `CRON_SECRET`을 넣어 둡니다.
- cron-job.org에서는 이 값을 **Authorization 헤더**에 넣어 호출합니다.

---

## 2. cron-job.org 작업 3개 만들기

**기본 URL**  
`https://여기에는-실제-도메인.vercel.app` 대신, **버핏 API가 실제로 동작하는 서버 주소**로 바꿉니다.  
예: `https://your-server.com` 또는 Vercel이면 `https://your-app.vercel.app` (단, Vercel에서는 Python 미지원이라 위 설명대로 별도 서버 필요).

### 작업 1: 매일 — 현재가 수집 (prices)

| 항목 | 값 |
|------|-----|
| **Title** | `Buffett prices (일별)` |
| **URL** | `https://YOUR_DOMAIN/api/cron/buffett-prices` |
| **Schedule** | 매일 1회. 권장: **한국 시간(KST) 기준** 장 마감 후 (예: 06:00 또는 07:00) |
| **Request method** | GET |
| **Request headers** | Add header → Name: `Authorization`, Value: `Bearer 여기에_CRON_SECRET_값` |

### 작업 2: 매일 — 평가 실행 (result full)

| 항목 | 값 |
|------|-----|
| **Title** | `Buffett result full (일별)` |
| **URL** | `https://YOUR_DOMAIN/api/cron/buffett-result-full` |
| **Schedule** | 매일 1회. **작업 1(prices)보다 뒤** (예: KST 06:30 또는 07:30) |
| **Request method** | GET |
| **Request headers** | Add header → Name: `Authorization`, Value: `Bearer 여기에_CRON_SECRET_값` |

### 작업 3: 연 1회 — 재무제표 수집 (financials)

| 항목 | 값 |
|------|-----|
| **Title** | `Buffett financials (연 1회)` |
| **URL** | `https://YOUR_DOMAIN/api/cron/buffett-financials` |
| **Schedule** | 연 1회. 예: **매년 1월 2일 02:00 KST** (또는 원하는 날·시간) |
| **Request method** | GET |
| **Request headers** | Add header → Name: `Authorization`, Value: `Bearer 여기에_CRON_SECRET_값` |

---

## 3. cron-job.org에서 설정하는 절차

1. [cron-job.org](https://cron-job.org) 로그인 후 **Create cron job** 선택.
2. 위 표대로 **Title**, **URL**, **Schedule**, **Request method**, **Request headers** 입력.
3. **Authorization** 헤더에 `Bearer ` 뒤에 CRON_SECRET 값을 붙여 넣습니다. (공백 한 칸 유지)
4. 저장 후 활성화.

같은 방식으로 **작업 1·2·3**을 각각 한 번씩 만들면 됩니다.

---

## 4. 실행 순서 요약

| 빈도 | 실행 내용 | API |
|------|-----------|-----|
| **매일** | ① 현재가 수집 | `/api/cron/buffett-prices` |
| **매일** | ② 평가 실행 (새 run_id) | `/api/cron/buffett-result-full` |
| **연 1회** | 재무제표 수집 | `/api/cron/buffett-financials` |

매일은 **① → ②** 순서로 돌리면 됩니다. (현재가 수집 후 평가)

---

## 5. 수동 테스트 (로컬 또는 서버)

서버가 `https://your-server.com` 이라면:

```bash
# 현재가 수집
curl -X GET "https://your-server.com/api/cron/buffett-prices" \
  -H "Authorization: Bearer 여기에_CRON_SECRET_값"

# 평가 실행
curl -X GET "https://your-server.com/api/cron/buffett-result-full" \
  -H "Authorization: Bearer 여기에_CRON_SECRET_값"

# 재무제표 (연 1회)
curl -X GET "https://your-server.com/api/cron/buffett-financials" \
  -H "Authorization: Bearer 여기에_CRON_SECRET_값"
```

`"success": true` 와 `data.message` 가 나오면 정상 동작한 것입니다.  
실패 시 응답에 `stderr` 등이 포함될 수 있으니 로그로 확인하면 됩니다.
