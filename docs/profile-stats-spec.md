# 전적 및 승률 조회 페이지 명세

> `/profile/stats` 페이지의 기능·데이터·UI 명세 및 트러블슈팅 기록

---

## 1. 개요

### 1.1 목적

- 로그인 사용자의 **정산 완료 투표 이력** 조회
- **승률·전적** 요약 표시 (UserInfoCard)
- **전체 기간** 누적 기준 (시즌 제거됨)

### 1.2 URL

- `/profile/stats`

### 1.3 레이아웃

- 양옆 여백, max-w-6xl 콘텐츠 영역
- 상단: UserInfoCard (순위, 닉네임, 승률, 전적, 가용 코인, MMR)
- 하단: 정산 이력 테이블 + 날짜 필터

---

## 2. 데이터 소스

### 2.1 API

| API | 용도 |
|-----|------|
| `GET /api/profile/vote-history` | 정산 이력 rows + summary (승/패/승률) |
| `GET /api/rank/me` | UserInfoCard용 (statsOverride 없을 때 fallback) |

### 2.2 vote-history 응답 구조

```ts
{
  success: true,
  data: {
    rows: VoteHistoryRow[],
    current_balance: number,
    summary: { wins: number, losses: number, win_rate_pct: number }
  }
}
```

### 2.3 VoteHistoryRow

| 필드 | 타입 | 설명 |
|------|------|------|
| poll_date | string | 예측 대상일 (DB) |
| poll_date_display | string | 표시용 (btc_1d KST 보정) |
| settled_at | string | 정산 완료 시각 |
| market | string | btc_1d, btc_4h 등 |
| market_label | string | 표시 라벨 |
| choice | "UP" \| "DOWN" | 롱/숏 선택 |
| bet_amount | number | 배팅 코인 |
| price_open | number \| null | 시가 |
| price_close | number \| null | 종가 |
| change_pct | number \| null | 가격변동률 |
| result | "win" \| "loss" \| "invalid" | 승/패/무효 |
| payout_amount | number | 표시용 (승:+수익, 패:-배팅, 무효:0) |
| cumulative_win_rate_pct | number | 해당 행까지 누적 승률 |
| balance_after | number | 정산 직후 총 보유 코인 |

---

## 3. 승부 판정 (payout_amount 기준)

| 결과 | payout_amount | 승률·전적 집계 |
|------|---------------|----------------|
| **승리** | 수익(양수), bet ≠ payout | wins++ |
| **패배** | 0 | losses++ |
| **무효** | bet_amount (원금 환불) | 제외 |

- **승률** = wins / (wins + losses) × 100
- **전적** = "X승 Y패"

---

## 4. UserInfoCard 연동

### 4.1 statsOverride

- 전적·승률 조회 페이지에서는 **vote-history의 summary**를 UserInfoCard에 전달
- 단일 데이터 소스: 테이블 최상단 행 누적승률 = UserInfoCard 승률

### 4.2 표시 우선순위

1. `statsOverride` 있음 → summary 기반 표시
2. 없음 → `/api/rank/me` (getMyTierStats) 기반 표시

---

## 5. 정렬·필터

### 5.1 정렬

- **표시 순서**: settled_at 내림차순 (최신 정산이 위)
- **누적 승률 계산**: settled_at 오름차순으로 순회 후 계산

### 5.2 날짜 필터

- 쿼리: `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- 기준: sentiment_polls.poll_date
- 필터 적용 시 해당 기간 데이터만 조회·집계

---

## 6. 시즌 제거 (2026-03)

### 6.1 변경 내용

- **기존**: 연 3등분 시즌(1~4월, 5~8월, 9~12월) 기준으로 승률·전적·MMR 집계
- **변경**: 시즌 제거, **전체 기간 누적** 기준으로 통합

### 6.2 삭제된 파일

- `src/lib/constants/seasons.ts`

### 6.3 수정된 로직

- `getSettledPollIdsInSeason` → `getSettledPollIds` (날짜 필터 제거)
- `refreshMarketSeason` → `refreshMarketStats`
- `computeUserStatsForSeason` → `computeUserStats`
- rank/me, user_stats: 시즌 구분 없이 전체 기간 기준

---

## 7. 트러블슈팅

### 7.1 승자 VTC 미지급

→ `docs/voting-spec.md` 7.5 참조

### 7.2 user_stats 승리 과다 집계

**증상**: UserInfoCard 승률·전적이 실제보다 높게 표시됨.

**원인**: `refreshMarketStats`에서 payout_history의 **모든 행**을 승리로 카운트 (패배·무효 포함).

**수정**: 승리만 `payout_amount > 0 && payout_amount !== bet_amount`로 필터.

### 7.3 UserInfoCard vs 테이블 누적승률 불일치

**증상**: 테이블 최상단 행 누적승률과 UserInfoCard 승률이 다름.

**원인**:
- UserInfoCard: `/api/rank/me` (user_stats 또는 getMyTierStats) — 시즌/스코프 다름
- 테이블: vote-history API — 전체(또는 필터 기간)

**수정**: vote-history API에 `summary` 추가, UserInfoCard에 `statsOverride`로 전달. 단일 소스로 통일.

### 7.4 wins 변수 const 재할당 에러

**증상**: `cannot reassign to a variable declared with 'const'` (Turbopack 빌드).

**원인**: 루프 변수 `wins`와 summary 객체 속성 `wins` 혼동 가능성.

**수정**: 루프 변수 `wins` → `winCount`로 변경.

### 7.5 승률 UI % 중복 표시

**증상**: UserInfoCard에 "65.0%%"처럼 %가 두 번 표시됨.

**원인**: statsOverride 값에 이미 `%` 포함 + 맨 끝 `%` 추가.

**수정**: statsOverride는 숫자만 반환, 맨 끝 `%` 하나만 표시.

### 7.6 Internal Server Error

**증상**: 페이지 로드 시 500 에러.

**가능 원인**: tier-service `users` 조회 `.single()` — 사용자 없을 때 throw.

**수정**: `.maybeSingle()`로 변경. 서버 재시작으로 해결되는 경우도 있음 (캐시).

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `src/app/profile/stats/page.tsx` | 전적 및 승률 조회 페이지 |
| `src/app/api/profile/vote-history/route.ts` | 정산 이력 API |
| `src/app/api/rank/me/route.ts` | 랭크·승률 API |
| `src/components/home/UserInfoCard.tsx` | 유저 정보 카드 (statsOverride 지원) |
| `src/lib/tier/tier-service.ts` | MMR·승률 계산 (전체 기간) |
| `scripts/verify-win-rate-from-db.sql` | 승률 DB 검증 SQL |

---

## 9. 검증

- `scripts/verify-win-rate-from-db.sql`: payout_history 기반 실제 승/패 vs user_stats 비교
