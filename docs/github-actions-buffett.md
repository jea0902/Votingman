# GitHub Actions — 버핏 원픽 자동 실행

Vercel에는 Python이 없어서, **GitHub Actions**로 버핏 데이터 수집·평가를 매일 자동 실행합니다. PC나 별도 서버 없이 GitHub에서 알아서 돌아갑니다.

## 실행 내용

| 워크플로우 | 스케줄 | 내용 |
|-----------|--------|------|
| `buffett-daily` | 매일 KST 06:30 | ① 현재가 수집 (`prices`) ② 평가 실행 (`result full`) |
| `buffett-financials-yearly` | 매년 1월 2일 KST 02:00 | 재무제표 수집 (`financials`) |

---

## 1단계: GitHub Secrets 추가

1. GitHub에서 이 **저장소** 열기 → **Settings** → 왼쪽 메뉴 **Secrets and variables** → **Actions**
2. **New repository secret** 클릭하여 아래 2개 추가:

| Name | Value | 비고 |
|------|-------|------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`과 동일 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` | `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY`와 동일 |

이미 Vercel/다른 곳에 있는 값과 **같은 값**을 넣으면 됩니다.

---

## 2단계: 워크플로우 배포

1. 이 문서의 변경 사항 포함하여 `main` 브랜치에 **push**
2. push 후 자동으로 워크플로우가 등록됩니다.

---

## 3단계: 수동 테스트

1. GitHub 저장소 → 상단 **Actions** 탭
2. 왼쪽에서 **"Buffett Daily (prices + result)"** 선택
3. 오른쪽 **"Run workflow"** → **Run workflow** 클릭
4. 실행 로그에서 `prices` 수집과 `result full` 실행이 정상인지 확인

실패 시: **Secrets**(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)가 올바른지 다시 확인하세요.

---

## 스케줄 변경

`buffett-daily.yml` 안의 `cron` 값을 수정하면 실행 시각을 바꿀 수 있습니다.

```yaml
# 예: 매일 KST 07:00로 변경 (UTC 22:00)
- cron: "0 22 * * *"
```

**cron 형식**: `분 시 일 월 요일` (UTC 기준)

| KST 시각 | cron 예시 |
|---------|----------|
| 06:00 | `0 21 * * *` |
| 06:30 | `30 21 * * *` |
| 07:00 | `0 22 * * *` |

---

## cron-job.org 사용 중이었다면

GitHub Actions로 바꾸면 **cron-job.org의 Buffett 작업 3개**는 더 이상 필요 없습니다. 삭제하거나 비활성화해도 됩니다.

---

## 에러 발생 시

1. **Actions** 탭 → 해당 실행 선택 → 실패한 job 클릭
2. 실패한 step을 클릭해 상세 로그 확인
3. 자주 나오는 오류:
   - Secrets 미설정: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 추가 여부 확인
   - 패키지 오류: `public/scripts/requirements.txt` 버전 충돌 시 버전 조정
