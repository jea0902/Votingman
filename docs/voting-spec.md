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

### 2.2 시장별 타임존·크론 (캔들 마감 판단 기준)

| 시장 | 타임존 | Cron 실행 | DB 수집 |
|------|--------|-----------|---------|
| btc_1d | Asia/Seoul | 매일 KST 09:00 | btc_ohlc 형식 |
| btc_4h | **UTC** | every 4 hours | btc_ohlc 형식 |
| btc_1h | Asia/Seoul | every 1 hour | btc_ohlc 형식 |
| btc_15m | Asia/Seoul | every 15 minutes | btc_ohlc 형식 |
| btc_5m | Asia/Seoul | every 5 minutes | btc_ohlc 형식 |

- **btc_4h만 UTC** (00, 04, 08, 12, 16, 20 UTC). 나머지(1d, 1h, 15m, 5m)는 **Asia/Seoul** 기준으로 캔들 마감·크론 실행.
- DB·정산 비교용 `candle_start_at`은 UTC ISO로 저장. 캔들 마감 여부는 `candle_start_at + 봉 주기(ms) < now(UTC)` 로 판단.

### 2.3 Cron 실행 시각 요약

| Cron | 타임존 | 실행 주기 | 수집 대상 |
|------|--------|----------|----------|
| btc-ohlc-daily | Asia/Seoul | 매일 09:00 | btc_1d 직전 마감 캔들 |
| btc-ohlc-4h | UTC | 4시간마다 (00/04/08/12/16/20) | btc_4h 직전 마감 캔들 |
| btc-ohlc-1h | Asia/Seoul | 1시간마다 | btc_1h 직전 마감 캔들 |
| btc-ohlc-15m | Asia/Seoul | 15분마다 | btc_15m 직전 마감 캔들 |
| btc-ohlc-5m | Asia/Seoul | 5분마다 | btc_5m 직전 마감 캔들 |

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

### 6.4 btc_4h 마감 시각 (UTC 기준으로 통일, 2026-03 재적용)

**결론**: 4h는 **UTC 00, 04, 08, 12, 16, 20** 시 정각 마감 (Binance 4h와 동일).
- 크론은 00:05, 04:05, … 20:05 **UTC**에 실행. 1h 집계 없이 Binance 4h API 직접 사용.

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

### 6.19 btc_4h UTC로 되돌림 (2026-03)

**결정**: btc_4h만 KST 정렬·1h 집계로 문제가 반복되어, **UTC 기준(Binance 4h 그대로)** 로 통일.
- **candle-utils**: getCurrentCandleStartAt, getRecentCandleStartAts, getCandlesForPollDate, getCandleStartAtForMarket → btc_4h는 전부 **getBtc4hCandleStartAtUtc** 사용.
- **btc-klines**: btc_4h 전용 1h 4개 집계 제거. **fetchKlines("4h", startMs, 1)** 로 Binance 4h 직접 사용.
- **cron**: 00:05, 04:05, 08:05, 12:05, 16:05, 20:05 **UTC**에 실행하도록 cron-job.org 스케줄 설정.
- **기존 KST btc_4h 데이터**: 필요 시 삭제 후 `scripts/btc_ohlc_backfill.py`로 UTC 4h 백필.

### 6.21 크론 호출 시각과 getRecentCandleStartAts — 폴 못 찾아 승리 -> 무효 판정 트러블 슈팅 (2026-03)

**증상**: 모든 시간봉 투표에서 유저가 투표했는데 승리자의 판정이 무효가 되어서 몇시간동안 문제를 해결하려고 붙잡음.
=> 결론 : 폴 못 찾음. 크론을 "1분 뒤"로 설정하니 성공.

**원인**: `getRecentCandleStartAts(market, 1)` = `now - period`. **21:50:00 직전**에 크론이 도착하면 **21:40 캔들**을 찾고, **21:50:00 이후**에 도착하면 **21:45 캔들**을 찾는다.

| 크론 도착 시각 | getRecentCandleStartAts 결과 | 유저 투표(21:48) 대상 |
|----------------|------------------------------|------------------------|
| 21:49:59       | 21:40 캔들                   | 21:45 캔들 → **불일치** |
| 21:50:00       | 21:45 캔들                   | 21:45 캔들 → 일치      |
| 21:51:00       | 21:45 캔들                   | 21:45 캔들 → 일치      |

- 21:48에 투표 → **21:45 캔들**에 투표 (21:45~21:50 구간)
- 크론이 21:49:59에 도착 → 21:40 캔들 정산 시도 → 사용자가 투표한 21:45 폴과 다름 → 실패
- 크론이 21:51에 도착 → 21:45 캔들 정산 → 사용자 투표와 일치 → 성공

**해결**: cron-job.org에서 **마감 1분 후**에 크론 실행 (예: 5분봉이면 01, 06, 11, …, 56분에 실행).

**초등학생도 이해할 설명**:
- 5분봉 캔들: 21:40~21:45, 21:45~21:50, 21:50~21:55 …
- 21:48에 투표 = **21:45 캔들**에 투표 (아직 진행 중)
- 크론은 "지금 시각 − 5분"에 해당하는 캔들을 찾음
- 21:49:59에 크론 도착 → 21:44:59 → **21:40 캔들** 찾음 (사용자는 21:45에 투표) → **틀림**
- 21:51:00에 크론 도착 → 21:46:00 → **21:45 캔들** 찾음 (사용자와 같음) → **맞음**
- 그래서 크론을 **1분 뒤**에 돌리면 항상 맞는 캔들을 찾음

**cron 10초 단위 가능 여부**: cron-job.org는 **최소 1분 간격**만 지원 (시간당 최대 60회). 10초 단위 스케줄은 불가.

**해결: 3초 지연 (2026-03 적용)**: cron-job.org는 5분 간격(00, 05, 10, …) 그대로 두고, 크론 핸들러에서 **인증 직후 3초 대기** 후 `fetchKlinesKstAligned` 호출. 21:49:59 도착해도 3초 후 21:50:02 → getRecentCandleStartAts가 21:45 캔들 반환. btc-ohlc-5m, 15m, 1h, 4h, daily 모두 `CRON_START_DELAY_MS = 3000` 적용. Vercel Hobby(10초 타임아웃)에서 3초+실제 작업이 10초 초과 시 504 가능 → 그때는 2초로 줄이거나 1분 뒤 크론으로 복귀.

**테스트 성공 (2026-03)**: 5초→3초 지연 적용 후 cron-job.org 5분 간격(00, 05, 10, …) 그대로 두고 테스트 → 정산 성공. 1분 뒤 크론 설정 없이 5분 간격 유지 가능. **5분봉, 15분봉, 1시간봉 전부 테스트 완료.**

### 6.22 1초 조기 마감 (2026-03)

**증상**: 마감 시각에 투표 차단하려 해도 약 2초 지연으로 마감 직후까지 투표 가능.

**수정**: `VOTING_CLOSE_EARLY_MS = 1000` (candle-utils). 마감 시각 1초 전부터 투표 차단.
- **Vote API** `isPollCandleClosed`: `closeUtcMs = candle_start_at + period - 1000`
- **Poll API** settlement_status: 동일 1초 조기
- **sentiment-vote.ts** `getRollingCloseUtcMs`, `getBtc1dCloseUtcMs`: 카운트다운·마감 문구 1초 앞당김

### 6.23 정산 완료 문구 — 알림 도착 시에만 표시 (2026-03)

**증상**: "정산 중입니다..." 이후 "정산이 완료되었습니다"가 나와도 알림은 약 2초 후에 옴. 문구와 알림 시점 불일치.

**수정**: Poll API에 `show_settled_complete` 추가.
- **참여자**(투표한 사용자): 해당 폴의 payout 알림(notifications.related_payout_id)이 생성된 뒤에만 `true`
- **비참여자**: `settlement_status === "settled"`이면 즉시 `true`
- **Predict 페이지**: `show_settled_complete`가 `true`일 때만 "정산이 완료되었습니다." 표시. settled이지만 알림 미도착 시 "정산 중입니다..." 유지. 5초마다 폴링하여 알림 도착 시 갱신.

### 6.24 마감 시각 표시 수정 (2026-03)

**증상**: 투표 제목 아래 "2026년 3월 9일 0시에 마감" 문구가 카운트다운과 불일치. btc_4h는 UTC 정렬인데 KST 00/04/08 형식으로 잘못 표시됨.

**수정**:

| 구분 | 내용 |
|------|------|
| **폴별 마감 시각** | `getCloseTimeKstString(market, candleStartAt?)` — candle_start_at 있으면 해당 폴 마감 시각 표시 |
| **polls API** | 응답에 `candle_start_at` 추가. 홈·predict 페이지에서 폴별 마감 시각 사용 |
| **btc_4h** | 내부 UTC 정렬(00/04/08/12/16/20 UTC), UI는 KST로 표시 (카운트다운과 동일) |
| **봉 경계 표시** | 마감 = period - 1초(00:59:59)인데 "0시"로 나오던 문제 → 봉 경계 시각(01:00)으로 표시 |
| **카운트다운 동기화** | `CountdownTimer`에 `candleStartAt` 전달. `getMillisUntilClose(market, candleStartAt?)` 옵션 추가 |

**적용 위치**: predict 페이지, MarketVoteCard, MarketVoteCardCompact, PollData 타입.

### 6.26 정산 후 refreshMarketStats 비동기화 (2026-03)

**증상**: 정산(승패 판정 → 알림)까지 40초 이상 소요.

**원인**: `refreshMarketStats(TIER_MARKET_ALL)`가 정산 직후 `await`로 호출됨. 전체 참여 유저를 순회하며 `user_stats` upsert (N건 순차) → 10~30초 블로킹.

**수정**: `refreshMarketStats`를 fire-and-forget으로 변경. 정산·알림(DB 트리거) 완료 후 즉시 응답 반환. MMR/리더보드 갱신은 백그라운드 실행.

**적용**: btc-ohlc-4h, 5m, 15m, 1h, daily 모든 크론 라우트.

### 6.27 정산 시간 최소화 최적화 (2026-03)

**목표**: 참여 유저 수가 많을 때 정산 시간 단축.

| 구분 | 기존 | 최적화 |
|------|------|--------|
| **invalidRefundAll** | 순차: payout insert 1건 → RPC 1건 반복 | payout_history 배치 insert 1회 → add_voting_coin 20건씩 병렬 |
| **승자 처리** | 승자별 순차: RPC → payout insert | add_voting_coin 20건씩 병렬 → payout_history 배치 insert 1회 |
| **패자 처리** | 순차 payout insert N회 | payout_history 배치 insert 1회 |
| **refreshMarketStats** | user_stats 1건씩 upsert N회 | user_stats 배치 upsert 1회 |

**상수**: `RPC_BATCH_SIZE = 50` (DB 연결 풀 부하 분산).

### 6.28 정산 추가 최적화 (2026-03)

| 구분 | 기존 | 최적화 |
|------|------|--------|
| **payout_history insert** | 승자 1회 + 패자 1회 (2 round-trip) | 승자+패자 통합 1회 insert |
| **알림 트리거** | — | FOR EACH STATEMENT 시도 → 일부 환경 미동작으로 ROW 트리거 유지 (무효 포함 모두 알림) |
| **add_voting_coin** | N회 RPC | add_voting_coin_bulk 1회 (마이그레이션 20260310100000) |
| **ensure_users** | N회 RPC | ensure_users_for_settlement_bulk 1회 |

### 6.29 동일가 판정 완화 + 무효 알림 (2026-03)

- **동일가 판정**: 소수 둘째자리 → 넷째자리. 변동 0.01% 이하도 둘째자리에서 동일가로 잘못 판정되던 문제 수정.
- **무효 알림**: payout_history insert 시 트리거로 알림 생성. 무효(payout_amount=bet_amount) 포함 모든 정산에 알림 전송.

### 6.25 BTC 투표 상세 페이지 차트 (2026-03)

**구성**: `BtcChart` (components/predict/BtcChart.tsx). predict/[market] 페이지에서 btc 시장일 때 표시.

#### 구현 방식

| 구분 | 내용 |
|------|------|
| **라이브러리** | lightweight-charts (TradingView 오픈소스) |
| **초기 데이터** | Binance REST API 직접 호출 (`api.binance.com/api/v3/klines`) |
| **실시간** | Binance WebSocket (`wss://stream.binance.com:9443/ws/btcusdt@kline_{interval}`) |
| **로딩** | `dynamic(..., { ssr: false })` — 클라이언트 전용, 번들 분리 |

#### 데이터 흐름

1. 마운트 시 REST로 초기 캔들 로드 (1m/15m/1h/4h/1d 선택 가능)
2. WebSocket 연결 후 틱 단위 실시간 캔들 업데이트 (`series.update`)
3. 시간봉 전환 시 기존 WebSocket 해제 → REST 재요청 → 새 WebSocket 연결

#### 최적화

| 항목 | 값 | 설명 |
|------|-----|------|
| **초기 로드** | 80봉 | `INITIAL_LOAD_LIMIT` — 첫 진입 시 가벼운 로드 |
| **추가 로드** | interval별 상이 | 1m/15m: 1000, 1h: 500, 4h: 400, 1d: 365 |
| **지연 로딩** | `LOAD_MORE_THRESHOLD=40` | 왼쪽 스크롤 시 `from < 40`이면 과거 데이터 추가 요청 |
| **중복 차단** | `loadingMoreRef` | 동시에 여러 `fetchBtcKlines` 호출 방지 |
| **목표가 뷰** | `autoscaleInfoProvider` | 목표가(priceToBeat)가 항상 Y축 범위에 포함되도록 padding 15% |
| **가시 봉 수** | interval별 | 1m: 60, 15m/1h: 48, 4h: 42, 1d: 60 |

#### UI

- 시간봉 버튼: 1분 / 15분 / 1시간 / 4시간 / 1일
- 목표가(시가) 수평선: `createPriceLine` — "목표가" 라벨
- WebSocket 상태 표시: 실시간 / 연결 중 / 연결 끊김
- 다크 테마 (THEME.bgCard, candleUp/Down 등)

### 6.20 btc_4h 변경 사항 요약 (2026-03)

| 구분 | 내용 |
|------|------|
| **정렬** | KST → **UTC** (Binance 4h와 동일, 00/04/08/12/16/20 UTC) |
| **수집** | 1h 4개 집계 제거 → **Binance 4h API 직접** 사용 |
| **cron 스케줄** | 00:05, 04:05, 08:05, 12:05, 16:05, 20:05 **UTC** (cron-job.org 타임존 UTC, 4시간 간격) |
| **코드** | candle-utils: getCurrentCandleStartAt, getRecentCandleStartAts, getCandlesForPollDate, getCandleStartAtForMarket → btc_4h는 getBtc4hCandleStartAtUtc. btc-klines: fetchKlines("4h", startMs, 1) |
| **백필** | 기존 btc_4h 전부 삭제 후 `python scripts/btc_ohlc_backfill.py --market btc_4h --end-datetime "YYYY-MM-DDTHH:MM:SSZ"` 로 UTC 4h만 백필. 삭제 SQL: `scripts/check-backfill-and-unsettled-polls.sql` 0번 참고. |

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

### 7.7 크론 실패 대책 시스템 (2026-03)

크론 실패 시 원인 확인·복구를 위해 아래를 사용한다.

| 구분 | 설명 |
|------|------|
| **실패 기록** | 실패 시 `cron_error_log` 테이블에 job_name, error_code, error_message, **context**(jsonb) 저장. context에는 실패 시도한 market, candle_start_at 등 포함. |
| **500 응답 본문** | 크론이 500 반환 시 body에 `{ success: false, error: { code, message, context } }` 포함 → 수동 호출 시 원인 확인 가능. |
| **모니터 API** | `GET /api/monitor/cron-errors`: 마지막 실패 에러 목록 (인증: x-cron-secret 또는 **관리자 세션**). `GET /api/monitor/unsettled-polls?job_name=btc-ohlc-4h`: 해당 job의 미정산 폴(poll_id, candle_start_at) 목록. |
| **관리자 페이지** | **/admin** → "크론 상태" 링크 → **/admin/cron-status**. DB 실패 로그 조회 + job별 미정산 폴 목록 + "N건 정산 실행" 버튼으로 `POST /api/admin/backfill-and-settle` 호출해 복구. |
| **btc-ohlc-daily** | 동일하게 recordCronError + context 기록, refreshMarketStats 실패 시에도 500 없이 로그만 남김. |

**복구 흐름**: 1) Vercel 로그 또는 /admin/cron-status에서 실패 에러·context 확인. 2) 같은 페이지에서 미정산 폴 목록 확인 후 "정산 실행" 클릭. 3) 터미널만 쓰려면 `GET /api/monitor/unsettled-polls?job_name=...` 로 poll_id 조회 후 `POST /api/admin/backfill-and-settle` 에 `{ "pollIds": ["..."] }` 전달.

**크론 인증(401 Unauthorized 시)**: cron-job.org 등에서 호출 시 `CRON_SECRET` 필요. (1) **헤더**: `x-cron-secret: <CRON_SECRET>` 또는 `Authorization: Bearer <CRON_SECRET>` (cron-job.org 편집 시 "Request Headers"에 추가). (2) **쿼리**: 헤더 설정이 어려우면 URL에 `?cron_secret=<CRON_SECRET>` 추가 가능(예: `https://www.votingman.com/api/cron/btc-ohlc-4h?cron_secret=...`). Vercel 환경변수 `CRON_SECRET`과 동일한 값 사용.

**마이그레이션**: `cron_error_log`에 `context jsonb` 컬럼 추가 (`supabase/migrations/20260308100000_cron_error_log_context.sql`).

**실패 이력 전체 조회**: 실패할 때마다 `cron_error_history` 테이블에 1건 INSERT(추가). `GET /api/monitor/cron-errors` 응답에 `history`(최근 50건, 모든 job 혼합) 포함. /admin/cron-status 화면에서 "최근 실패 이력 (모든 job)" 섹션으로 확인. **/admin/cron-errors** URL은 /admin/cron-status로 리다이렉트.

**정산 시 일부 승자 지급 실패**: 특정 user_id의 VTC 지급(users 테이블 update)이 실패해도 나머지 승자는 계속 정산하고, 폴은 settled 처리. 실패한 user_id 목록은 `SettlementResult.failed_user_ids`로 반환되며, backfill-and-settle 응답 및 크론 상태 페이지 메시지에 표시. 해당 사용자는 수동 보정 필요.

**크론 401 Unauthorized 대응 (2026-03)**:
- **환경변수**: Vercel/로컬에서 `CRON_SECRET`(언더스코어) 또는 `CRON-SECRET`(하이픈) 둘 다 읽음. (`src/lib/cron/auth.ts`의 `getCronSecret()`)
- **공용 인증**: 모든 크론·모니터·backfill-and-settle 인증이 `isCronAuthorized(request)` 사용. 헤더 `x-cron-secret` / `Authorization: Bearer <secret>` + 쿼리 `?cron_secret=<secret>` 지원.
- **재배포**: Vercel에 환경변수 추가·변경 후 반드시 재배포해야 런타임에 반영됨. 재배포 없이 크론만 돌리면 401 발생할 수 있음.
- **개발 시 401**: btc-ohlc-4h 등에서 401 시 개발 환경이면 응답에 `debug: "CRON_SECRET (or CRON-SECRET) not set in env."` 포함해 원인 확인 가능.

### 7.8 btc-ohlc-daily(1일봉) 500 실패 시 점검·해결

**실패 시 원인 확인** (우선순위):
1. **관리자 페이지**: /admin → 크론 상태 → `btc-ohlc-daily` 항목의 error_code, error_message, context 확인 (배포된 코드에서 recordCronError 사용 시).
2. **API**: `GET /api/monitor/cron-errors` (x-cron-secret 또는 관리자 세션) → `job_name: "btc-ohlc-daily"` 의 error_message 확인.
3. **Vercel**: 해당 시각(예: 09:00 KST) Function Logs에서 `[cron/btc-ohlc-daily] error:` 검색.

**가능한 원인**:
| 원인 | error_code | 대응 |
|------|------------|------|
| Binance API 장애/지역제한/타임아웃 | BINANCE_ERROR | 재실행 또는 btc_ohlc에 1d 봉이 이미 있으면 정산만 시도(아래 폴백) |
| btc_ohlc upsert 실패 (스키마/타입) | DB_UPSERT_ERROR | 마이그레이션·컬럼 확인 |
| 정산 로직 예외 (users 없음, update 실패 등) | SETTLEMENT_ERROR | 로그의 user_id/poll_id 확인, 수동 보정 또는 backfill-and-settle |
| 그 외 (refreshMarketStats 제외) | CRON_ERROR | 스택 트레이스로 위치 확인 |

**코드 측 대책** (적용됨):
- 실패 시 `recordCronError("btc-ohlc-daily", code, message, context)` 로 DB 저장 + 500 본문에 context 포함.
- `refreshMarketStats` 실패 시 try-catch로 500 방지.
- **Binance가 빈 배열 반환 시**: `getRecentCandleStartAts("btc_1d", 1)` 로 기대 candle_start_at 계산 후 정산만 시도(btc_ohlc에 이미 행이 있으면 정산 가능). 정산 성공 시 200 반환.

**수동 복구**: 미정산 1일봉 폴은 /admin/cron-status에서 "1일봉" 미정산 목록 → "정산 실행", 또는 `POST /api/admin/backfill-and-settle` 에 해당 poll_id 전달.

### 7.9 미정산 폴 정규화·목표가(시가) UTC·차트 일치 (2026-03)

**미정산 폴 정산 시 candle_start_at 비경계 값 호환**
- btc_1d: `candle_start_at`이 00:00이 아니어도 해당 UTC일 00:00 봉으로 조회·수집 (`getBtc1dCandleStartAtUtc`). repository `getOhlcByMarketAndCandleStart` 및 `backfillAndSettlePoll`에서 적용.
- btc_4h: 03:00 등 비경계 값이어도 해당 구간 4h 경계(00/04/08/12/16/20 UTC)로 조회·수집. `normalizeBtc4hCandleStartAt`(candle-utils), repository·backfillAndSettlePoll 적용.
- 크론 상태 페이지 "정산 실행" 후 일부 폴만 실패해도 per-poll 에러 메시지 표시(`errPolls`).

**목표가(시가) UTC 기준**
- Poll API(`GET /api/sentiment/poll`): btc_1d/btc_4h일 때 `ohlcKey`(UTC 00:00 또는 4h 경계)로 이전 봉 조회 후 `price_open`·`price_close` 반환. 규칙 문구(PollRulesContent) btc_4h: "목표가 = 새 봉의 직전 4h 봉 종가 (UTC 기준, Binance와 동일)."

**btc_4h 목표가 = 차트와 정확히 일치**
- 차트(BtcChart)는 Binance REST/WebSocket 4h 봉을 사용. 목표가를 DB에서만 쓰면 저장 시점 차이로 직전 4h 봉 종가와 어긋날 수 있음.
- btc_4h일 때 목표가는 **Binance API**(`fetchPreviousCandleClose`) 우선 조회, 실패 시만 DB fallback. 이렇게 해서 4시간봉 차트의 "직전 4h 봉 종가"와 목표가 선이 동일한 값으로 맞음.
- 1일/1시간/15분봉은 기존처럼 DB 우선 유지.

**차트 기본 봉**: 모든 투표 상세 페이지에서 차트 기본은 1분봉(`defaultInterval="1m"`). 사용자가 15분/1시간/4시간/1일 버튼으로 전환 가능.

### 7.10 정산 시 승자 VTC 지급 실패 원인 및 제거 (절대 실패하지 않도록)

**실패 가능 원인 전부와 각각의 해결**

| # | 원인 | 설명 | 해결 |
|---|------|------|------|
| 1 | **users 행 없음** | 투표 시에는 users 조회로 행 존재. 정산 시점에 없으면(탈퇴·DB 삭제·동기화 지연 등) 지급 불가. | `ensure_user_for_settlement(uuid)` RPC: auth.users에 있으면 public.users에 최소 행 생성. 정산에서 add_voting_coin 실패 시 1회 호출 후 재시도. |
| 2 | **update 0 rows / race** | select 후 update 사이에 행 변경·삭제되거나, 동시 요청으로 인한 불일치. | 제거: select+update 제거. `add_voting_coin(user_id, amount)` RPC로 **원자적** 잔액 증가만 수행. |
| 3 | **numeric/제약** | voting_coin_balance가 numeric(20,2). 부동소수·음수 시 제약 위반. | RPC 내부에서 `ROUND(..., 2)`, `GREATEST(0, p_amount)` 적용. 클라이언트에서도 totalAfterFee 소수 둘째자리 반올림 유지. |
| 4 | **RLS** | 일반 클라이언트로 update 시 RLS로 차단 가능. | 정산은 항상 service_role(admin)으로 호출 → RLS 우회. |

**구현 요약**
- **add_voting_coin(p_user_id, p_amount)** (DB): 한 번의 UPDATE로 잔액 증가. user 없으면 null 반환. amount는 ROUND·음수 방지 적용.
- **ensure_user_for_settlement(p_user_id)** (DB): public.users에 없고 auth.users에 있으면 최소 행(user_id, email, nickname, role, voting_coin_balance=0) 생성. 기타 NOT NULL 컬럼이 있으면 예외 시 false 반환.
- **정산 흐름**: 승자마다 `add_voting_coin` 호출 → null이면 `ensure_user_for_settlement` 호출 후 성공 시 `add_voting_coin` 1회 재시도 → 그래도 실패 시 payout_history insert + failed_user_ids (알림은 발생, 잔액은 수동 보정).

**남는 실패 가능성 (드묾)**
- auth.users에도 없는 사용자(계정 완전 삭제 등): ensure가 false → 재시도 안 함 → failed_user_ids.
- public.users에 NOT NULL 컬럼이 더 있는데 RPC에 미포함: INSERT 시 예외 → ensure가 false → 동일. 이 경우 마이그레이션에서 해당 컬럼에 DEFAULT 추가하거나 RPC의 INSERT 대상 컬럼을 확장하면 됨.

### 7.11 크론 상태·미정산 폴·시장별 타임존 (2026-03)

**크론 상태 페이지 (admin/cron-status)**
- 미정산 폴: **모든 시장** (1일봉, 4h, 1h, 15m, 5m) 표시. 그리드 레이아웃.
- **참여 1건 이상인 폴만** 표시: `sentiment_votes`에서 `bet_amount > 0`인 poll_id만 필터. 무참여/무효 예정 폴 제외.
- 캔들 마감 판단: `candle_start_at`은 DB에서 UTC ISO로 저장. 타임존 없으면 UTC로 파싱(`parseCandleStartMs`). `candle_start_at + 봉 주기(ms) < now(UTC)` 이면 마감된 것으로 간주.

**시장별 타임존·크론 (캔들 마감 기준)** — §2.2, §2.3 및 candle-utils 주석에 반영
- btc_1d: 타임존 Asia/Seoul. 매일 KST 09:00 cron. DB btc_ohlc 형식 수집.
- btc_4h: 타임존 **UTC**. every 4 hours. DB btc_ohlc 형식 수집.
- btc_1h: 타임존 Asia/Seoul. every 1 hour. DB btc_ohlc 형식 수집.
- btc_15m: 타임존 Asia/Seoul. every 15 minutes. DB btc_ohlc 형식 수집.
- btc_5m: 타임존 Asia/Seoul. every 5 minutes. DB btc_ohlc 형식 수집.

**1h/15m/5m 크론 에러 기록**
- btc-ohlc-1h, btc-ohlc-15m, btc-ohlc-5m 라우트에 `recordCronError` 추가. 실패 시 context(market, candle_start_at) 저장. `refreshMarketStats` try-catch. 정산 시 `candle_start_at` ISO 정규화.

### 7.12 투표 상세 페이지 실시간 배팅 반영 (2026-03)

- **목적**: 다른 유저가 베팅해도 새로고침 없이 인원/코인 합계 갱신.
- **구현**: `settlement_status === "open"` 일 때만 **3초마다** 현재 폴 재조회 (`fetchPoll({ candle_start_at })`). 동일 폴 유지를 위해 `candle_start_at` 옵션 사용.
- **갱신 항목**: long_count, short_count, long_coin_total, short_coin_total, my_vote, settlement_status 등 전체 폴 데이터.

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
| `src/app/api/cron/btc-ohlc-4h/route.ts` | btc_4h cron |
| `src/lib/cron/auth.ts` | 크론 인증 공용 (getCronSecret, isCronAuthorized. CRON_SECRET/CRON-SECRET, 헤더·쿼리 지원) |
| `src/lib/monitor/cron-error-log.ts` | 크론 실패 기록/조회 (recordCronError, getCronErrors, getCronErrorHistory) |
| `src/app/api/monitor/cron-errors/route.ts` | 실패 에러·이력 조회 API (관리자 또는 x-cron-secret) |
| `src/app/api/monitor/unsettled-polls/route.ts` | job별 미정산 폴 조회 (참여 1건 이상만, candle_start_at UTC 파싱) |
| `src/components/admin/CronStatusPanel.tsx` | 크론 상태 UI (에러·이력·전체 시장 미정산·정산 실행) |
| `src/app/admin/cron-status/page.tsx` | 관리자 크론 상태 페이지 (에러·미정산·정산 실행) |
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
| 2026-03-08 | btc_4h UTC로 되돌림 (6.19): Binance 4h 직접 사용, cron UTC 스케줄 |
| 2026-03-08 | btc_4h 변경·백필 요약 (6.20), 크론 실패 대책 시스템 (7.7): cron_error_log context, 모니터 API·admin/cron-status, unsettled-polls 복구 |
| 2026-03-08 | btc-ohlc-daily 500 점검·해결 (7.8): 원인 확인 방법, Binance 빈 응답 시 정산 폴백 |
| 2026-03-08 | cron_error_history 추가(모든 실패 이력), /admin/cron-errors→cron-status 리다이렉트, 정산 시 일부 승자 지급 실패해도 나머지 진행+failed_user_ids 반환 |
| 2026-03-08 | 크론 401 대응: 공용 auth(lib/cron/auth), CRON_SECRET/CRON-SECRET 지원, 쿼리 인증(?cron_secret), 재배포 필요 안내 (7.7) |
| 2026-03-08 | 미정산 폴 정규화(btc_1d/btc_4h), 목표가 UTC·차트 일치(btc_4h Binance 우선), 정산 실패 per-poll 에러 표시, 차트 기본 1분봉 (7.9) |
| 2026-03-09 | 승자 지급 실패 원인 제거(7.10): add_voting_coin RPC(원자적 잔액 증가), ensure_user_for_settlement RPC(auth→users 복구), 정산에서 RPC 호출·실패 시 1회 재시도 |
| 2026-03-09 | cron-status 전체 시장 미정산 폴(1h/15m/5m 추가), 미정산=참여 1건 이상만 표시, candle_start_at UTC 파싱(7.11) |
| 2026-03-09 | 시장별 타임존·크론 정리: btc_4h만 UTC, 나머지 Asia/Seoul. 문서·candle-utils·unsettled-polls 주석 반영 |
| 2026-03-09 | btc_1h/15m/5m cron에 recordCronError·context·refreshMarketStats try-catch·candle_start_at ISO 정규화 |
| 2026-03-09 | 투표 상세 페이지 실시간 배팅 반영(7.12): 오픈 중 3초마다 폴 재조회, fetchPoll(candle_start_at) 옵션 |
| 2026-03-09 | 크론 호출 시각·getRecentCandleStartAts 타이밍(6.21): 21:50 직전 도착 시 21:40 캔들 찾음→폴 불일치. 5초 지연 적용, 테스트 성공 |
| 2026-03-09 | 1초 조기 마감(6.22): VOTING_CLOSE_EARLY_MS=1000. Vote/Poll API, sentiment-vote 적용 |
| 2026-03-09 | 정산 완료 문구(6.23): show_settled_complete. 참여자는 알림 도착 시에만 "정산이 완료되었습니다" 표시 |
