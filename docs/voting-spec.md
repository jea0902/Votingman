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

| 시장 | Binance 정렬 | KST 마감 시각 (예시) |
|------|-------------|---------------------|
| btc_4h | UTC 00, 04, 08, 12, 16, 20 | 01:00, 05:00, **09:00**, 13:00, 17:00, 21:00 |
| btc_1h | UTC 매시 정각 | 매시 정각 |
| btc_15m | UTC 00, 15, 30, 45 | 15분 단위 |
| btc_5m | UTC 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 | 5분 단위 |

- **4h의 09:00 KST**: UTC 20:00 봉이 UTC 00:00에 마감 → KST 09:00. **정상**.
- 4h는 UTC 4의 배수(0,4,8,12,16,20) 기준. KST로는 4의 배수가 아님.

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

- **btc_1d**: UTC 00:00 정렬. KST 09:00 이전 → 어제 UTC, 09:01 이후 → 오늘 UTC.
- **btc_4h/1h/15m/5m**: UTC 기준 (Binance와 동일).

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

**수정**: `getCurrentCandleStartAt(btc_1d)`를 UTC 00:00 정렬로 변경.
- KST 09:00 이전 → `getYesterdayUtcDateString()`
- KST 09:01 이후 → `getTodayUtcDateString()`

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

### 6.4 btc_4h 마감 09:00 KST 의문

**증상**: "4배수로 마감되어야 하는데 09:00이 가능한가?"

**결론**: **정상**. 4h는 UTC 기준 00, 04, 08, 12, 16, 20시.
- UTC 20:00 봉 → UTC 00:00 마감 = KST 09:00.
- KST 마감 시각: 01:00, 05:00, 09:00, 13:00, 17:00, 21:00.

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

### 7.4 정산 검증 SQL

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

---

## 9. 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/btc-ohlc/candle-utils.ts` | getCurrentCandleStartAt, 캔들 시각 |
| `src/lib/utils/sentiment-vote.ts` | 투표 허용 여부, 마감 시각 |
| `src/lib/sentiment/settlement-service.ts` | 정산 로직 |
| `src/app/api/sentiment/vote/route.ts` | 투표 API |
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
