# 투표 기능 명세서

> 보팅맨 인간 지표(데일리 투표) 기능의 상세 명세 및 트러블슈팅 기록

---

## 1. 개요

### 1.1 기능 요약

- **시장**: btc_1d, btc_4h, btc_1h, btc_15m (비트코인 1일/4시간/1시간/15분봉)
- **투표**: UP(롱) / DOWN(숏) + VTC 배팅
- **정산**: 봉 마감 후 종가 비교 (reference_close vs settlement_close)
- **데이터 소스**: Binance BTC/USDT, btc_ohlc 테이블

### 1.2 핵심 원칙

- **정산 기준**: 항상 **UTC** (Binance 표준). KST는 표시용.
- **candle_start_at**: 폴·정산 매칭의 유일 키. UTC ISO 문자열.
- **목표가(시가)**: 이전 봉 종가. 고정값 (실시간 변동 없음).

---

## 2. 시장별 마감 시각

### 2.1 btc_1d (1일봉)

| 항목 | 값 |
|------|-----|
| Binance 정렬 | UTC 00:00 |
| 투표 허용 | KST 09:01 ~ 다음날 09:00 |
| 마감 시각 | KST 09:00 (= UTC 00:00) |
| Cron | btc-ohlc-daily, 매일 KST 09:00 |

- **주의**: KST 09:00 = UTC 00:00. 정산 대상 캔들은 `candle_start_at = 전날 UTC 00:00`.

### 2.2 btc_4h, btc_1h, btc_15m (롤링)

| 시장 | 정렬 기준 | 마감 시각 (KST) |
|------|----------|-----------------|
| btc_4h | **KST** 00, 04, 08, 12, 16, 20 (크론과 동일) | 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 |
| btc_1h | UTC 매시 정각 | 매시 정각 |
| btc_15m | UTC 00, 15, 30, 45 | 15분 단위 |
| btc_5m | UTC 00, 05, 10, … | 5분 단위 |

- **btc_4h**: 크론이 KST 00/04/08/12/16/20에 돌므로, 마감·정산도 KST 해당 시각 기준. 1h 캔들 4개 집계로 OHLC 생성.

### 2.3 Cron 실행 시각

| Cron | 실행 주기 | 수집 대상 |
|------|----------|----------|
| btc-ohlc-daily | 매일 KST 09:00 | btc_1d 직전 마감 캔들 |
| btc-ohlc-4h | 4시간마다 | btc_4h 직전 마감 캔들 |
| btc-ohlc-1h | 매시 정각 | btc_1h 직전 마감 캔들 |
| btc-ohlc-15m | 15분마다 | btc_15m 직전 마감 캔들 |
| btc-ohlc-5m | 5분마다 | btc_5m 직전 마감 캔들 |

---

## 3. 캔들·폴 매칭

### 3.1 btc_ohlc 테이블

| 컬럼 | 용도 |
|------|------|
| **candle_start_at** | 정산·폴 매칭에 사용 (UTC) |
| candle_start_at_kst | 표시/검증용 (KST) |

- `candle_start_at` 00:00 UTC = `candle_start_at_kst` 09:00 KST (동일 시각).

### 3.2 getCurrentCandleStartAt 규칙

- **btc_1d**: UTC 00:00 정렬. **항상** `getTodayUtcDateString()` 사용. 현재 UTC 날짜의 캔들 = 다음 00:00 UTC에 마감.
- **btc_4h/1h/15m/5m**: UTC 기준 (Binance와 동일).
- **btc_1d 투표 허용**: `isVotingOpenKST`도 UTC 기준 (`candle_start_at + 24h`). KST 분 계산 사용 금지.

### 3.3 sentiment_polls

- `(market, candle_start_at)` UNIQUE.
- 폴 생성 시 `getCurrentCandleStartAt` 사용 → **반드시 UTC 정렬**이어야 cron 정산과 일치.

---

## 4. 정산 로직

### 4.1 가격 비교

- **reference_close**: 이전 봉 종가 = 현재 봉 시가 (btc_ohlc.open)
- **settlement_close**: 현재 봉 종가 (btc_ohlc.close)
- **승리**: settlement_close > reference_close → 롱 / settlement_close < reference_close → 숏

### 4.2 집계 소스

- **반드시 sentiment_votes에서 집계** (long_coin_total, short_coin_total 사용 금지).
- 폴 캐시는 동시성·누락 이슈로 부정확할 수 있음.

### 4.3 수수료

- 승자 정산 금액(원금+수령분)에 1% 수수료 적용.

---

## 5. 알림

- **트리거**: payout_history INSERT 시 `payout_notification_trigger` → notifications INSERT
- **대상**: 승리/패배/무효 모두 (payout_history에 기록되는 모든 사용자)
- **확인**: `LEFT JOIN notifications ON related_payout_id = payout_history.id`

---

## 6. 트러블슈팅 기록 (2026-03-07)

### 6.1 btc_1d 정산 누락 (폴·캔들 불일치)

**증상**: 6명 투표했는데 정산이 09:00에 안 되고, 19:44에 수동 정산됨.

**원인**: `getCurrentCandleStartAt(btc_1d)`가 KST 00:00 정렬(`getBtc1dCandleStartAt`)을 사용함.
- 사용자 폴: `candle_start_at = 2026-03-05 15:00 UTC` (KST 3/6 00:00)
- Cron 정산 대상: `2026-03-06 00:00 UTC` (Binance 1d)
- 결과: 폴이 cron 정산 대상과 달라서 자동 정산되지 않음.

**수정**: `getCurrentCandleStartAt(btc_1d)`를 UTC 00:00 정렬로 변경. (※ 6.11에서 추가 수정됨)

### 6.2 목표가(시가) 실시간 변동

**증상**: 1일봉 상세 페이지 목표가가 실시간으로 바뀜.

**원인**: 위 6.1과 동일. 잘못된 캔들 참조.

**수정**: 6.1 수정으로 해결.

### 6.3 승리 시 VTC 미수령/부족

**증상**: 승리했는데 VTC를 제대로 못 받음.

**원인**: 정산 시 `long_coin_total`, `short_coin_total`(폴 캐시) 사용.
- 동시 투표·API 오류로 캐시가 틀릴 수 있음.
- `loserPool`, `winnerTotalBet` 오계산 → 지급액 부족.

**수정**: `sentiment_votes`에서 직접 집계.
```ts
const winnerTotalBet = winnerVotes.reduce((sum, v) => sum + Number(v.bet_amount ?? 0), 0);
const loserPool = loserVotes.reduce((sum, v) => sum + Number(v.bet_amount ?? 0), 0);
```

### 6.4 btc_4h 마감 시각 (KST 기준으로 통일)

**결론**: 4h는 **KST 00, 04, 08, 12, 16, 20** 시 정각 마감 (크론 실행 시각과 동일).
- 크론이 KST 기준 4시간마다 돌기 때문에, 마감·정산도 KST 해당 시각으로 통일.

### 6.5 추가 투표 확정 버튼 무반응

**증상**: 확정 버튼이 활성화되어 있는데 안 눌림.

**원인**: `handleVote` 내 early return 조건.
```ts
if (vote === choice && isAdditionalMode && myBetAmount + chargeAmount === totalCharge) return;
```
- 추가 모드에서 `totalCharge = myBetAmount + chargeAmount`이므로 조건이 항상 참.
- API 호출 없이 바로 return.

**수정**: 해당 조건 삭제.

### 6.6 BTC OHLC 백필 스크립트

**추가**: Python ccxt 기반 `scripts/btc_ohlc_backfill.py`
- 2017-08-18 ~ 현재, btc_1d/4h/1W
- Rate limit 1.5초, Supabase REST API upsert

### 6.7 승리자인데 전적 패·알림 -VTC로 표시 (btc_15m 등)

**증상**: payout_history에 승자로 기록됐는데 전적에 패로 찍히고, 알림에 `-26500 VTC` 등으로 표시됨.

**원인**: `payout_amount` 의미 불일치.
- **정산 서비스**: 승리자 `payout_amount = 수익(profit)` (원금 제외)
- **vote-history/알림 트리거**: `payout_amount > bet_amount` 를 승리로 판정
- 승리 시 수익은 보통 bet보다 작아서 → 잘못된 '패'로 분류

**수정**:
- `src/app/api/profile/vote-history/route.ts`: `payout_amount === 0` → 패, `payout_amount === bet` → 무효, `payout_amount > 0 && !== bet` → 승
- `src/lib/stats/cumulative-win-rate.ts`: 동일 로직
- `payout_notification_trigger`: `scripts/fix-payout-notification-trigger.sql` 또는 `supabase/migrations/20260307000000_fix_payout_notification_trigger.sql` 실행

### 6.8 btc_5m 목표가(시가) 수정

**증상**: btc_5m 목표가가 5분 전 캔들 종가와 맞지 않음.

**원인**: btc_5m이 KST 정렬을 사용했으나 Binance 5분봉은 UTC 00, 05, 10, 15... 기준.

**수정**: btc_5m을 btc_4h처럼 UTC 정렬로 변경.
- `getBtc5mCandleStartAtUtc` 추가
- `getCurrentCandleStartAt`, `getRecentCandleStartAts`에서 btc_5m UTC 정렬 사용

### 6.9 Go to Live Market 버튼 안 나오는 문제 (롤링 시장)

**증상**: btc_5m 등 롤링 시장에서 마감 시간이 지나도 "Go to Live Market" 버튼이 안 나옴.

**원인**: 롤링 시장은 마감 직후 바로 다음 캔들로 전환되어 `voteOpen`이 true로 유지됨. 마감 박스는 `!voteOpen`일 때만 표시되어, btc_5m에서는 거의 표시되지 않음.

**수정**:
- `hasPollClosed`: `poll.candle_start_at + CANDLE_PERIOD_MS` 기준으로 폴 마감 여부 판단
- `showClosedBox`: `!voteOpen || hasPollClosed`일 때 마감 박스 표시
- Poll API: `candle_start_at` 쿼리 파라미터 지원, 응답에 `candle_start_at` 포함
- 정산 폴링: poll 캔들 마감 시에도 `candle_start_at`으로 해당 폴 조회하여 settlement_status 갱신

### 6.10 "다시 투표할 수 있습니다" 문구 제거

**이유**: Go to Live Market 클릭 시 새로고침되어 새 투표에 참여 가능하므로 불필요.

**수정**: "~부터 다시 투표할 수 있습니다" / "~다시 투표 가능" 문구 전부 제거. 마감 시 "마감"만 표시.

### 6.11 btc_1d 조기 마감 (UTC 00:00 전에 마감됨)

**증상**: UTC 03-07 00:00 전인데 "정산중입니다...", "결과는 프로필>전적에서 확인할 수 있습니다" 표시되고 투표 불가.

**원인**: `getCurrentCandleStartAt(btc_1d)`에서 09:01 KST 이전에 `getYesterdayUtcDateString()` 사용.
- 예: UTC 03-06 15:00 (KST 03-07 00:00) → yesterday UTC = 03-05 → 03-05 캔들(03-06 00:00 마감) → 이미 마감된 폴 표시

**수정**: 09:01 이전/이후 구분 제거. **항상** `getTodayUtcDateString()` 사용.
- 현재 UTC 날짜의 캔들 = 다음 00:00 UTC에 마감
- 예: UTC 03-06 15:00 → 03-06 캔들(03-07 00:00 마감) ✓

### 6.12 마감 시 UI 동작

**동작**:
- **마감 박스 표시**: `!voteOpen` 또는 `hasPollClosed`일 때 "이 투표는 마감되었습니다" / "정산 중입니다..." / "정산이 완료되었습니다." 박스 표시
- **Go to Live Market 버튼**: 마감 박스 내 버튼 클릭 시 `window.location.reload()` → 새 투표지 로드
- **투표 불가**: `canVote = voteOpen && !hasPollClosed && !!user` → 마감 시 투표 버튼 비활성화
- **다음 투표 링크**: 마감 시 "다음 투표" 영역에 다른 시장으로 이동하는 "Go to Live Market" 링크 표시

### 6.13 btc_1d 마감 시 투표/VTC 사라짐 (초기화처럼 보임)

**증상**: 1일봉 마감(09:00 KST) 시 투표한 VTC, 인원 수가 사라짐.

**원인**: `voteOpen`이 false로 바뀔 때마다 `fetchPoll()` 호출. 09:00 KST에 API가 **새 폴**(다음날 캔들)을 반환 → 기존 폴(투표 있음) 대신 새 폴(0표) 표시.

**수정**: `voteOpen` true→false 전환 시 refetch 하지 않음. 마감된 폴을 정산 완료까지 유지. 새 폴로 전환은 "Go to Live Market" 클릭(새로고침) 시에만.

### 6.15 btc_ohlc(DB) 단일 기준 — 시간 계산 제거

**원칙**: cron이 수집·저장한 btc_ohlc만 기준. 마감/정산/새 poll은 DB 상태로 판단.

**수정**:
- **Poll API settlement_status**: `isVotingOpen`, `isPollCandleClosed`(시간) 제거. `price_close != null`(btc_ohlc 존재) = 마감.
- **Vote API**: btc 시장은 `getOhlcByMarketAndCandleStart`로 마감 여부 검사. btc_ohlc에 행 있으면 투표 거부.
- **fetchCurrentCandleCloseForBtc1dKst 폴백 제거**: Binance 직접 조회 금지. btc_ohlc만 사용.
- **클라이언트**: btc 시장은 `poll.settlement_status`만 사용. 시간 기반 `voteOpen`/`hasPollClosed` 미사용.

### 6.14 btc_1d UTC 기준 통일 (조기 마감·KST 불일치 방지)

**증상**: cron이 1일봉 데이터를 수집하기도 전에 마감 표시. 마감 풀었더니 poll이 새것으로 바뀌어 투표/VTC 사라짐.

**원인**: `isVotingOpenKST`가 KST 분(mins) 계산 사용, `getCurrentCandleStartAt`은 UTC 사용 → 두 로직 불일치.

**수정**: btc_1d를 **UTC 단일 기준**으로 통일.
- `isVotingOpenKST(btc_1d)`: `Date.now() < getCurrentCandleStartAt + CANDLE_PERIOD_MS` (롤링 시장과 동일 패턴)
- `getMillisUntilClose`, `getCloseTimeKstString`, `getNextOpenTimeKstString`: `getBtc1dCloseUtcMs()` 사용
- 마감 시각 = candle_start_at + 24h = UTC 00:00 = cron 수집 시각과 동일

### 6.16 백필로 진행 중 캔들 저장 → 조기 마감 (병신같은 사례)

**증상**: KST 07:52에 btc_1d 투표가 마감됨. cron은 09:00에만 실행되는데 왜?

**원인**: **백필을 마감 시각(KST 09:00) 이전에 실행**함.
- 바이낸스 API는 진행 중인 캔들도 반환함. `close` = 요청 시점의 현재가 (실제 종가 아님).
- 백필 시 22:19 KST 03-06에 03-06 캔들(마감 09:00 KST 03-07) 수집 → 아직 진행 중인 캔들이 btc_ohlc에 저장됨.
- `price_close != null` → 시스템이 마감으로 판단 → 투표 조기 마감.

**교훈**:
- btc_1d 백필은 **해당 캔들 마감 시각(KST 09:00) 이후**에만 실행할 것.
- 진행 중 캔들 = 미래 데이터 아님. 바이낸스가 그 시점 현재가를 close로 줌. 그걸 저장하면 잘못된 종가 + 조기 마감.

**수정**: Poll API에 **마감 시각 검증** 추가. `price_close != null`이어도 `Date.now() >= candle_start_at + CANDLE_PERIOD_MS`일 때만 마감 처리. DB에 잘못 들어간 데이터가 있어도 09:00 이전에는 "open" 유지.

### 6.17 btc_4h cron 500 에러 및 KST 전환 트러블슈팅

**배경**: cron-job.org에서 btc-ohlc-4h가 4시간마다 실행되는데, 500 Internal Server Error로 실패. 크론은 **한국 시간 00, 04, 08, 12, 16, 20시**에 돌리도록 설정되어 있음.

**원인 정리**:
1. **500 원인**: Vercel 로그에 `invalid input syntax for type bigint` 등 DB 타입 오류. `users.voting_coin_balance`, `payout_history` 등이 bigint인데 소수/문자열이 들어감 → 마이그레이션으로 `numeric(20,2)` 변경.
2. **데이터·크론 불일치**: 크론은 KST 00/04/08/12/16/20에 돌는데, 당시 btc_4h 데이터는 **Binance 4h API**(UTC 00/04/08/12/16/20) 기준으로 수집·백필됨. 즉 마감 시각이 UTC와 KST로 어긋나 폴·정산이 맞는 봉을 못 찾거나 잘못 매칭될 수 있는 상태.

**해결 방향**: btc_4h를 **KST 기준**으로 통일.
- Binance에는 **4h KST** 봉이 없고 **4h UTC**만 있으므로, **1h 봉 4개**를 조회해서 KST 구간(00–04, 04–08, …)별로 집계.
- **open** = 구간 첫 1h 시가, **high/low** = 4개 중 max/min, **close** = 구간 마지막 1h 종가(= 해당 KST 마감 시각 가격).
- cron은 계속 KST 00/04/08/12/16/20에 실행하고, 그 시각에 “방금 마감한” KST 4h 구간의 1h 4개를 가져와 집계 후 `btc_ohlc`에 upsert.

**수정 사항**:
- `candle-utils.ts`: `getCurrentCandleStartAt("btc_4h")`, `getRecentCandleStartAts("btc_4h")` → KST 00/04/08/12/16/20 정렬로 계산.
- `btc-klines.ts`: `fetchKlinesKstAligned("btc_4h")` 등에서 Binance 4h 대신 **1h 4개 조회 후 집계**.
- 기존 DB에 쌓인 **UTC 시대 btc_4h** 행은 삭제 후, **KST 정렬**로 처음부터 백필.
- 백필 스크립트: `scripts/btc_ohlc_backfill_4h_kst.py` (1h 봉 1000개씩 조회 → KST 4h 슬롯으로 그룹핑·집계 후 upsert).

**검증**: 집계된 4h 봉의 **close** = 마지막 1h 봉 close = 해당 KST 마감 시각(예: 04:00 KST)의 가격이므로, “한국 시간 기준 4h봉 종가” 개념과 일치.

### 6.18 btc_4h 마감 후 정산·알림 미실행

**증상**: btc_4h 투표는 마감됐는데 정산·알림이 오지 않음.

**원인**: `getRecentCandleStartAts("btc_4h", 1)` 버그로, cron이 **잘못된 캔들**을 수집·정산 시도.
- 크론은 “방금 마감한” 봉의 `candle_start_at`으로 `settlePoll` 호출.
- `getRecentCandleStartAts`에서 btc_4h 처리 시 `targetKstMs + 9h`로 KST 날짜·시를 추출하면서, **시(hour)**까지 +9h가 적용되어 잘못된 슬롯(예: 16시대)을 반환.
- 그래서 DB에 저장된 봉의 `candle_start_at`과 폴이 가진 `candle_start_at`이 달라짐 → `settlePoll`이 폴을 찾지 못함(“폴을 찾을 수 없습니다”) → 정산·알림 미실행.

**수정** (`candle-utils.ts`):
- **날짜**만 KST로 쓰기 위해 `targetKstMs + KST_OFFSET_MS`로 캘린더 계산.
- **시(hour)**는 `targetKstMs` 그대로 사용 (이미 KST 시가 반영된 값이므로 +9h 미적용).
- 이렇게 해서 “방금 마감한” KST 4h 슬롯과 폴의 `candle_start_at`이 일치하도록 수정.

**이미 마감만 되고 정산 안 된 폴**: `/api/admin/backfill-and-settle`에 해당 폴의 `candle_start_at`으로 정산 요청하거나, 동일한 `candle_start_at`을 가진 btc_4h 봉이 있는지 확인 후 수동 정산.

---

## 7. 정산 시스템 트러블슈팅

### 7.1 payout_amount 의미 (정산 기준)

| 결과 | payout_amount | users.voting_coin_balance | 비고 |
|------|---------------|--------------------------|------|
| **승리** | 수익(양수) | += 원금 + 수익 (1% 수수료 차감) | 실제 지급 = bet + payout_amount |
| **패배** | 0 | 변화 없음 | |
| **무효** | bet_amount | += bet_amount (원금 환불) | |

- 전적/알림 판정: `payout_amount === 0` → 패, `=== bet` → 무효, `> 0 && !== bet` → 승

### 7.2 정산 실패 시 점검

| 증상 | 원인 | 확인 방법 |
|------|------|----------|
| 폴을 찾을 수 없음 | cron의 candle_start_at ≠ DB 폴 | sentiment_polls.candle_start_at vs getRecentCandleStartAts 결과 비교 |
| btc_ohlc 가격 없음 | 캔들 미수집 | btc_ohlc에 해당 (market, candle_start_at) 존재 여부 |
| Cron 미실행 | Vercel/cron-job.org 미호출 | 로그, settle 응답 확인 |

### 7.3 정산 흐름 요약

```
Cron → fetchKlinesKstAligned(limit=1) → upsertBtcOhlcBatch → settlePoll(candle_start_at)
       ↓
sentiment_polls (market, candle_start_at) 조회 → btc_ohlc 가격 조회 → 승/패 판정
       ↓
승리자: users += (원금+수익)×0.99, payout_history(payout_amount=수익)
패배자: payout_history(payout_amount=0)
```

### 7.5 승자 VTC 미지급 (payout_history·알림은 정상, 잔액 미증가)

**증상**: payout_history에 승자 기록됨, 알림도 발송됨. 하지만 승자 `users.voting_coin_balance`가 증가하지 않음.

**원인**:
- `users` 조회 시 `.single()` 사용 → 사용자 없으면 에러지만 `{ data: u }`만 받아 에러 미검사
- Supabase `update`는 0 rows affected여도 `error`를 반환하지 않음
- update 실패해도 `payout_history` insert가 그대로 진행됨

**수정** (`settlement-service.ts`):
- users 조회: `.maybeSingle()` 사용, 사용자 없으면 throw
- users update: `.select("user_id")`로 결과 확인, 0 rows면 throw
- 무효/환불/관리자 무효 처리에도 동일 검증 적용

**수동 보정** (이미 발생한 건):
1. `scripts/debug-winner-vtc-not-credited.sql` 1번 쿼리로 poll_id·승자·users 매칭 확인
2. Supabase SQL Editor에서 아래 실행 (poll_id 교체):
```sql
UPDATE users u
SET voting_coin_balance = u.voting_coin_balance + ph.bet_amount + ph.payout_amount
FROM payout_history ph
WHERE u.user_id = ph.user_id
  AND ph.poll_id = '해당_poll_id'
  AND ph.payout_amount > 0;
```
- 주의: 이미 지급된 경우 중복 지급되므로, 1번 쿼리에서 `users_exists='OK'`인데 잔액이 안 올랐는지 확인 후 실행

### 7.6 정산 검증 SQL

```sql
-- 최근 정산된 폴 + 승자/패자 + 지급액 확인
WITH recent_settled AS (
  SELECT id, market, candle_start_at, settled_at
  FROM sentiment_polls
  WHERE settled_at IS NOT NULL
  ORDER BY settled_at DESC
  LIMIT 20
)
SELECT 
  p.market,
  p.candle_start_at,
  v.choice,
  v.bet_amount,
  ph.payout_amount AS profit,
  CASE WHEN ph.payout_amount > 0 THEN v.bet_amount + ph.payout_amount ELSE 0 END AS should_receive
FROM recent_settled p
JOIN sentiment_votes v ON v.poll_id = p.id AND v.bet_amount > 0
LEFT JOIN payout_history ph ON ph.poll_id = p.id AND ph.user_id = v.user_id
ORDER BY p.settled_at DESC, ph.payout_amount DESC NULLS LAST;
```

---

## 8. 검증 쿼리

- `scripts/verify-btc1d-settlement.sql`: 폴·투표·정산·알림 검증용 SQL
- `scripts/debug-winner-vtc-not-credited.sql`: 승자 VTC 미지급 디버깅·수동 보정용 (7.5)
- `docs/profile-stats-spec.md`: 전적 및 승률 조회 페이지 명세

---

## 9. 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/btc-ohlc/candle-utils.ts` | getCurrentCandleStartAt, CANDLE_PERIOD_MS, 캔들 시각 |
| `src/lib/utils/sentiment-vote.ts` | 투표 허용 여부, 마감 시각 |
| `src/lib/sentiment/settlement-service.ts` | 정산 로직 |
| `src/app/api/sentiment/vote/route.ts` | 투표 API |
| `src/app/api/sentiment/poll/route.ts` | 폴 조회 (candle_start_at 파라미터 지원) |
| `src/app/predict/[market]/page.tsx` | 투표 상세 페이지, 마감 박스·Go to Live Market 버튼 |
| `src/app/api/cron/btc-ohlc-daily/route.ts` | btc_1d cron |
| `scripts/fix-payout-notification-trigger.sql` | 알림 트리거 수정 |

---

## 10. 변경 이력

| 일자 | 변경 내용 |
|------|----------|
| 2026-03-07 | btc_1d getCurrentCandleStartAt UTC 정렬 수정 |
| 2026-03-07 | 정산 시 votes 기반 집계로 변경 |
| 2026-03-07 | 추가 투표 handleVote early return 제거 |
| 2026-03-07 | btc_ohlc_backfill.py 추가, btc-ohlc-4h cron 주석 수정 |
| 2026-03-07 | payout_amount 해석 수정 (vote-history, cumulative-win-rate, 알림 트리거) |
| 2026-03-07 | 정산 시스템 트러블슈팅 섹션 추가 |
| 2026-03-07 | btc_5m UTC 정렬, Go to Live Market 버튼(hasPollClosed), "다시 투표" 문구 제거, btc_1d 조기 마감 수정, 마감 시 UI 동작 명세 |
| 2026-03-07 | btc_1d 마감 시 refetch 제거(투표/VTC 유지, 6.13) |
| 2026-03-07 | btc_1d isVotingOpen/getMillisUntilClose 등 UTC 기준 통일 (6.14) |
| 2026-03-07 | btc_ohlc(DB) 단일 기준, 시간 계산 제거 (6.15) |
| 2026-03-07 | 백필로 진행 중 캔들 저장 → 조기 마감 트러블슈팅 (6.16), Poll API 마감 시각 검증 추가 |
| 2026-03-07 | 승자 VTC 미지급 트러블슈팅 (7.5), settlement-service update 검증 추가 |
| 2026-03-07 | btc_4h cron 500 및 KST 전환 트러블슈팅 (6.17): bigint 오류, KST 1h 집계 전환, 백필 스크립트 |
| 2026-03-07 | btc_4h 마감 후 정산·알림 미실행 (6.18): getRecentCandleStartAts btc_4h 슬롯 버그 수정 |
