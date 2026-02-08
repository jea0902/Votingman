# 보팅맨 홈 화면 구현 단계 (기존 DB·UI·API 반영)

기존 코드베이스와 `votingman-implementation-phases.md`를 기준으로, **홈 화면에 보팅맨 기능을 단계적으로 올리기 위한 구체 작업**을 정리한 문서입니다.

---

## 현재 상태 요약

| 구분 | 현재 구조 | 비고 |
|------|-----------|------|
| **홈** | `src/app/page.tsx` → `HumanIndicatorSection` 1개 + 플레이스홀더 5개 | 인간 지표 섹션은 이미 배치됨 |
| **API** | `GET /api/sentiment/poll`, `POST /api/sentiment/vote`, `GET /api/sentiment/btc-ohlc` | vote는 user_id 또는 anonymous_id 허용 |
| **DB** | `sentiment_polls` (long_count, short_count), `sentiment_votes` (choice만), `users` (voting_coin 없음) | 1인 1표·익명 허용 구조 |
| **UI** | `HumanIndicatorSection`: 롱/숏 비율·참여 수·시가·투표가 **API 미연동** (로컬 state·플레이스홀더만 사용) | 실제 투표 시 API 호출 없음 |

따라서 **먼저 기존 API와 UI를 연결**한 뒤, 문서의 1단계(로그인 전제 + 보팅코인)부터 순서대로 적용하는 흐름이 적합합니다.

---

## 0단계: 기존 인간 지표 UI ↔ API 연동 (선행 작업)

**목표**: 홈의 인간 지표 섹션이 이미 있는 poll/vote API와 실제로 연동되어, “오늘 비트코인 방향 투표”가 동작하는 상태로 만든다.

### 0-1. Poll 데이터 연동

- **대상**: `src/components/home/HumanIndicatorSection.tsx`
- **작업**:
  - 마운트 시 `GET /api/sentiment/poll` 호출해 `long_count`, `short_count`, `poll_id`, `btc_open`, `poll_date` 수신.
  - 수신한 값으로 롱/숏 비율(`longPct`, `shortPct`), 참여 수(`totalLabel`), 시가(USD/KRW) 표시.
  - `btc_open`이 없을 때는 기존처럼 `GET /api/sentiment/btc-ohlc` 또는 poll 응답 활용해 시가 표시.
- **선택**: 로그인 사용자면 기존 투표 여부/선택 조회 API가 있으면 연동해 `vote` 초기값 설정 (없으면 2단계에서 vote 응답으로 처리 가능).

### 0-2. Vote API 연동

- **대상**: `HumanIndicatorSection.tsx`의 `handleVote`
- **작업**:
  - `handleVote(choice)` 시 `POST /api/sentiment/vote` 호출.
    - 로그인: body에 `{ choice }` 만 전달 (서버에서 세션 user_id 사용).
    - 비로그인: 현재는 `anonymous_id` 전달하거나, 1단계에서 로그인 필수로 바꿀 예정이면 이 경로는 “로그인 유도”로만 두고 호출 생략 가능.
  - 응답의 `long_count`, `short_count`, `total_count`로 비율·참여 수 갱신.
  - 에러 시 토스트 등으로 메시지 표시, 낙관적 업데이트 시 실패하면 롤백.
- **결과**: 홈에서 “오늘 비트코인 방향” 투표가 DB에 반영되고, 롱/숏 비율이 인원 수 기준으로 갱신됨.

### 0-3. 완료 기준

- 홈 인간 지표에서 오늘 시가·롱/숏 비율·참여 수가 API 기준으로 표시됨.
- 롱/숏 버튼 클릭 시 vote API 호출 후 비율이 갱신됨.

이후부터는 `votingman-implementation-phases.md`의 **1단계 → 2단계 → …** 순서를 따르면 됩니다.

---

## 1단계: 로그인 전제 + 보팅코인 기반 (홈 반영)

**목표**: 투표는 로그인 사용자만 가능하게 하고, 사용자별 보팅코인 잔액을 도입한다. 홈에서는 “로그인하고 투표” 문구와 잔액 노출을 준비한다.

### 1-1. DB

- **users 확장**  
  - `users` 테이블에 `voting_coin_balance` (integer, 기본값 0) 추가.  
  - 또는 전용 `user_point_balances` 테이블 (user_id, balance, updated_at) 생성 후 RLS로 본인만 조회/갱신.
- **마이그레이션**: 기본값·NOT NULL 정책 결정 (예: 기존 유저 0, 신규 1000).
- **RLS**: 보팅코인 잔액은 본인만 SELECT/UPDATE.

### 1-2. API

- **POST /api/sentiment/vote**
  - `user_id` 없으면 401 반환. `anonymous_id` 경로 제거 또는 무시.
  - 비로그인 요청 시 `UNAUTHORIZED` + “로그인하고 투표하세요” 메시지.
- **보팅코인 조회**
  - `GET /api/me` 또는 `GET /api/user/balance` 등 기존 유저 정보 API에 `voting_coin_balance` 포함.
  - 또는 `GET /api/sentiment/balance` 신규: 로그인 시에만 본인 잔액 반환.
- **초기 지급**
  - 가입/최초 로그인 시 보팅코인 지급 로직 (예: 1000 코인).  
  - `auth/callback` 또는 signup API에서 한 번만 지급하도록 플래그 처리.

### 1-3. 홈 UI (HumanIndicatorSection)

- **비로그인**  
  - 투표 버튼 비활성 또는 숨김.  
  - “로그인하고 투표하세요” + 로그인 버튼만 노출 (이미 비슷한 블록 있음 → 메시지 통일).
- **로그인**  
  - 투표 가능.  
  - (선택) 섹션 상단/하단에 “보팅코인: 1,000” 같은 잔액 표시.  
  - 잔액은 1-2에서 만든 API로 조회.

### 1-4. 완료 기준

- 로그인 사용자만 데일리(비트코인) 투표 가능.
- 사용자별 보팅코인 잔액이 DB에 있고, 초기 지급 후 홈 또는 프로필에서 조회 가능.

---

## 2단계: 포인트 배팅으로 전환 (홈 반영)

**목표**: 1인 1표가 아니라 “보팅코인 N개 걸기”로 전환. 홈에서 배팅량 입력과 포인트 기준 비율을 노출한다.

### 2-1. DB

- **sentiment_votes**  
  - `bet_amount` (integer, 배팅한 보팅코인 수) 추가.
- **sentiment_polls**  
  - `long_points`, `short_points` (integer, 기본 0) 추가.  
  - 기존 `long_count`/`short_count`는 “참여 인원 수”로 유지할지, 제거할지 결정.

### 2-2. API

- **POST /api/sentiment/vote**
  - body에 `bet_amount` (number, 1 이상) 필수.
  - 사용자 잔액 검사 → 부족 시 400.
  - 기존 투표가 있으면: 기존 `bet_amount` 만큼 잔액 반환 후, 새 `bet_amount` 차감.
  - `sentiment_votes`에 `choice` + `bet_amount` 저장/업데이트.
  - 해당 폴의 `long_points` / `short_points` 집계 갱신 (vote insert/update/delete 시).
- **GET /api/sentiment/poll**
  - 응답에 `long_points`, `short_points` 포함.
  - 비율 계산은 `long_points / (long_points + short_points)` 등으로 클라이언트 또는 서버에서 제공.

### 2-3. 홈 UI (HumanIndicatorSection)

- “몇 코인 걸까?” 입력 또는 프리셋 버튼 (예: 10, 50, 100, 전체).
- 현재 잔액 표시 및 배팅량 ≤ 잔액 검증.
- 롱/숏 비율을 **포인트 기준**으로 표시 (예: “롱 65% / 숏 35%” + “롱 6,500P / 숏 3,500P”).
- (선택) 참여 인원 수는 `long_count`/`short_count`가 유지되면 “1,234명 참여”로 계속 표시.

### 2-4. 완료 기준

- 데일리 비트코인 투표가 “보팅코인 N개 걸기”로 동작.
- 홈에서 롱/숏 비율이 포인트 합계 기준으로 노출됨.

---

## 3단계: 파리뮤추얼 페이아웃 (홈 반영)

**목표**: 종가 확정 후 당첨자에게 패자 포인트 분배. 홈에서는 “어제 결과” 노출을 추가할 수 있다.

### 3-1. 백엔드

- **종가 확정**: 기존처럼 다음날 KST 00:00(또는 00:01) 이후 `btc_close` 수집 cron 유지.
- **정산 job**: `poll_date`별로 시가·종가로 롱/숏 당첨 판정 → 당첨자에게 파리뮤추얼 분배 → `users.voting_coin_balance` 갱신.
- **재실행 방지**: `sentiment_polls`에 `settled_at`(timestamp) 또는 `is_settled` 플래그 추가 후, 정산 완료 폴은 스킵.
- **정산 이력**: (선택) `payout_history` 테이블에 user_id, poll_id, amount, result(win/lose) 등 저장.

### 3-2. API

- (선택) `GET /api/sentiment/poll?poll_date=YYYY-MM-DD` 또는 `GET /api/sentiment/my-result?poll_date=YYYY-MM-DD`  
  → “어제 투표 결과: 당첨/낙첨, +N 보팅코인”용.

### 3-3. 홈 UI

- (선택) 인간 지표 섹션 또는 그 아래에 “어제 결과: 당첨 +120 코인” 같은 한 줄 뱃지/문구.

### 3-4. 완료 기준

- 매일 종가 확정 후 자동 정산, 당첨자 잔액 증가.
- (선택) 사용자에게 어제 결과 노출.

---

## 4단계: 3개 시장 섹션 확장 (홈 반영)

**목표**: 비트코인 + 미국 주식 + 한국 주식으로 섹션을 나누고, 홈에서 각각 투표할 수 있게 한다.

### 4-1. DB

- **sentiment_polls**  
  - `market` 또는 `symbol` 컬럼 추가 (예: `btc`, `ndq`, `sp500`, `kospi`, `kosdaq`).  
  - unique: (poll_date, market/symbol).
- **가격 데이터**: 시장별 시가·종가 저장 (기존 btc_open/btc_close는 비트코인 전용으로 두고, 다른 컬럼 또는 별도 테이블).

### 4-2. API

- **GET /api/sentiment/poll**  
  - 쿼리로 `market` 또는 `symbol` 지정.  
  - 또는 `GET /api/sentiment/polls?date=YYYY-MM-DD`로 해당일 전체 폴 목록 반환.
- **POST /api/sentiment/vote**  
  - `poll_id` 또는 `market`+`date`로 폴 지정.  
  - 시장별로 사용자가 보팅코인을 나눠서 배팅.

### 4-3. 홈 UI

- 인간 지표 영역을 **3블록**으로 구분:
  - 비트코인 (1개)
  - 미국 주식 (나스닥, S&P500)
  - 한국 주식 (코스피, 코스닥)
- 각 블록에서 “오늘 방향” + 배팅량 입력 + 롱/숏 비율(포인트 기준) 표시.
- 기존 `HumanIndicatorSection`을 “비트코인 전용”으로 두고, “미국 주식”, “한국 주식” 섹션을 새 컴포넌트로 추가하거나, 하나의 섹션 안에 탭/리스트로 통합.

### 4-4. 완료 기준

- 3개 섹션에서 각 시장(비트코인 1 + 미국 2 + 한국 2) 데일리 투표·집계 동작.
- 정산도 시장별 동일 파리뮤추얼 로직 적용 가능한 구조.

---

## 5단계: 시장세 + 과거 데이터 시각화 (홈 반영)

**목표**: 시장세 5단계 저장 및 “과거 같은 시장세일 때 배팅·승률”을 인간 지표 근처에 노출.

### 5-1. DB·백엔드

- 시장세 정의·저장 (`market_regime` 등), 연·월·주·일 단위 집계/뷰.
- “과거 동일 시장세 배팅 비율·당첨률” 조회용 API.

### 5-2. 홈 UI

- 인간 지표 섹션에 “현재 시장세: 상승장” 표시.
- “과거 상승장일 때: 롱 xx% / 숏 yy%, 당첨률 zz%” 블록 추가.

---

## 6단계: 가중치 + 티어 시스템 (홈 반영)

**목표**: 가중치 합산 포지션·상위 1% 포지션, 사용자 티어를 홈에 반영.

### 6-1. API·DB

- Voting_Power 계산, 가중치 합산 포지션/상위 1% API.
- 티어 계산(배치 5회 → 브론즈~), 사용자 테이블에 tier 저장.

### 6-2. 홈 UI

- 인간 지표 근처 또는 프로필에 “내 티어: 실버”.
- (선택) “가중치 기준 롱/숏 비율”, “상위 1% 포지션” 요약 한 줄.

---

## 7단계: 리더보드 + 홈 고수 포지션 (홈 반영)

**목표**: TOP 5 리더보드와 고수 실시간 포지션을 홈에 올린다.

### 7-1. API

- 보팅코인 또는 승률 기준 TOP 5 조회.
- TOP 5의 “오늘 투표(롱/숏)” 폴별 조회.

### 7-2. 홈 UI

- **기존 플레이스홀더 활용**: `page.tsx`의 `SECTION_LABELS` 중 “3. 고수/인플루언서 실시간 포지션”을 **실제 보팅맨 리더보드 + 고수 포지션**으로 교체.
- 위젯: 순위, 닉네임, 보팅코인(또는 승률), 티어 + “오늘 고수 N명 중 롱 m명, 숏 n명” 요약.

### 7-3. 완료 기준

- TOP 5 리더보드 노출, 해당 고수들의 당일 포지션이 홈에서 확인 가능.

---

## 단계별 의존 관계 (홈 기준)

```
0 (UI↔API 연동)  ← 반드시 선행
  → 1 (로그인 전제 + 보팅코인)
  → 2 (포인트 배팅)
  → 3 (페이아웃)
  → 4 (3개 시장)  ← 여기까지 “홈에서 데일리 배팅이 3개 시장에서 돈다”
  → 5 (시장세 + 시각화)
  → 6 (가중치 + 티어)
  → 7 (리더보드 + 고수 포지션)  ← 홈 플레이스홀더 “고수 실시간 포지션”을 실제 데이터로 교체
```

- **0단계**: 기존 HumanIndicatorSection이 있는 홈에서 실제로 poll/vote가 동작하도록 필수 선행.
- **1→2→3**: 순서 고정 권장 (포인트·정산이 없으면 배팅·페이아웃 불가).
- **4**: 3까지 완료 후, 비트코인 한 시장이 검증된 뒤 미국/한국 추가.
- **5~7**: 데이터와 지표가 쌓인 뒤 단계별로 홈에 위젯/문구 추가.

---

## 문서 이력

- 최초 작성: 기존 DB·UI·API 및 `votingman-implementation-phases.md` 반영, 홈 화면 기준 구체 단계 정리.
