# 보팅맨 투표 기록 확인 및 정산(무효판) 안내

## 1. 투표 기록을 어디서 볼 수 있는가?

### DB 테이블

- **`sentiment_votes`**: 개별 투표 1건당 1행  
  - `poll_id`, `user_id`, `choice` (long/short), `bet_amount`, `created_at`
- **`sentiment_polls`**: 폴(일별·시장별) 마스터  
  - `id`, `poll_date`, `market` (btc, ndq, …), `long_coin_total`, `short_coin_total`, …

“어제 비트코인 상방(롱)에 혼자 투표했다”는 기록은 **`sentiment_votes`** + **`sentiment_polls`**를 조인해 확인하면 됩니다.

### Supabase에서 직접 조회 (SQL)

Supabase Dashboard → SQL Editor에서 아래처럼 실행하면, **특정 사용자의 과거 투표 이력(폴 날짜·시장·선택·배팅 코인)**을 볼 수 있습니다.

```sql
-- 특정 user_id의 모든 투표 이력 (폴 날짜·시장·롱/숏·배팅 코인)
SELECT
  p.poll_date,
  p.market,
  v.choice,
  v.bet_amount,
  v.created_at
FROM sentiment_votes v
JOIN sentiment_polls p ON p.id = v.poll_id
WHERE v.user_id = '여기에_운영자_user_id_UUID'
  AND v.bet_amount > 0
ORDER BY p.poll_date DESC, v.created_at DESC;
```

- `user_id`는 `auth.users` 또는 `public.users`의 운영자 계정 `user_id`로 바꾸면 됩니다.
- “어제 비트코인”만 보려면 `p.poll_date = (CURRENT_DATE - INTERVAL '1 day')::date` 및 `p.market = 'btc'` 조건을 추가하면 됩니다.

### 앱/API에서 보는 방법

- **오늘 폴 + 내 투표**: `GET /api/sentiment/poll?market=btc`, `GET /api/sentiment/polls` 에서 `my_vote`(choice, bet_amount)로 확인 가능.
- **과거 투표 목록**을 보여주는 전용 페이지/API는 현재 코드베이스에 없습니다. 과거 이력은 위 SQL로 DB에서 확인하는 것이 가장 확실합니다.

---

## 2. 가용 코인이 0인 이유 (단독 참여·무효판과 정산)

### 규칙 요약 (기획서 기준)

- **단독 참여(무효판)**: 마감 시점에 `bet_amount > 0`인 유저가 **1명 이하**이면 무효판.
  - **처리**: 모든 참여자의 `bet_amount` **전액을 잔액(`users.voting_coin_balance`)으로 환불**.
  - 정산(payout)은 하지 않고, `payout_history`에도 넣지 않음.
  - 승률·티어·랭킹에서는 해당 폴 제외.

즉, 설계상 “혼자만 투표한 경우 이겨도 코인을 받지 않고, **지급도 차감도 없이 원금 환불**”이 맞습니다.  
**패자가 “코인을 가져간” 것이 아니라**, “**무효판일 때 환불해 주는 정산 로직이 없어서**, 투표 시 차감만 되고 환불이 안 된 상태”로 보는 것이 맞습니다.

### 현재 코드 상태

- **투표 시**: `POST /api/sentiment/vote` 에서 `bet_amount`만큼 **잔액에서 차감**하고, `sentiment_votes` / `sentiment_polls` 집계만 갱신합니다.
- **마감 후 정산** (구현됨):  
  - “종가 확정 후 자동 정산”, “무효판 시 전액 환불”을 **실제로 수행하는 배치/API/크론**이 이 프로젝트 코드베이스에는 `POST /api/sentiment/settle`, `POST /api/sentiment/poll/ohlc` 사용.

그래서:

1. 운영자 계정이 어제 비트코인 롱에 투표했을 때 → **그 순간 잔액에서 배팅 코인이 차감**됨.
2. 그 폴은 단독 참여(무효판)이므로, 설계대로라면 마감 후 **전액 환불**이 되어야 함.
3. 하지만 **무효판 환불을 실행하는 정산 코드가 없어서**, 환불이 한 번도 일어나지 않음.
4. 결과적으로 “패가 코인을 가져갔다”가 아니라, “**차감만 되고 환불이 안 되어** 가용 코인이 0으로 보이는 것”에 가깝습니다.

### 정리

| 질문 | 답변 |
|------|------|
| 투표 기록은 어디서 보나? | DB `sentiment_votes` + `sentiment_polls` 조인. Supabase SQL로 위 쿼리 사용. 앱에는 “과거 투표 목록” UI/API 없음. |
| 혼자만 투표했을 때 규칙은? | 무효판 → 전액 환불, 정산/지급 없음. 승률에도 반영 안 함. |
| 왜 가용 코인이 0인가? | 투표 시 차감은 됐지만, (당시) **정산(배치)이 미구현**이라 환불이 실행되지 않았기 때문. 현재는 정산 API 구현됨. |

### 권장 조치

1. **당장 잔액 복구**: 해당 폴의 무효판 참여자에게 전액 환불이 필요하다면, Supabase에서 해당 `user_id`의 `users.voting_coin_balance`를 수동으로 올리거나, 관리자용 “무효판 환불” API를 하나 만들어서 한 번만 호출하는 방식으로 처리할 수 있습니다.
2. **정산 API (구현됨)**: 마이그레이션 `005_sentiment_polls_settled_at.sql` 실행 후, 시가/종가 반영은 `POST /api/sentiment/poll/ohlc`, 정산 실행은 `POST /api/sentiment/settle` (body: poll_date, market). 이미 정산된 폴은 재실행되지 않음.
