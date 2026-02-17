# 정산(Settlement) 검증 및 트러블슈팅

## 수동 재정산 방법

**전제:** 해당 캔들이 `btc_ohlc`에 이미 있어야 합니다. 없으면 먼저 수집/백필 후 재정산하세요.

| 시장 | POST /api/sentiment/settle body | 비고 |
|------|----------------------------------|------|
| **btc_1d** | `{ "poll_date": "2026-02-12", "market": "btc_1d" }` | poll_date = KST 기준 해당 일 |
| **btc_4h / 1h / 15m** | `{ "market": "btc_4h", "candle_start_at": "2026-02-11T15:00:00.000Z" }` | candle_start_at = 해당 봉 UTC 시작 시각(ISO) |

**예시 (PowerShell)**

```powershell
# 1일봉: 2026-02-12 일봉 재정산
$body = '{"poll_date":"2026-02-12","market":"btc_1d"}'
Invoke-RestMethod -Uri "http://localhost:3000/api/sentiment/settle" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body $body

# 4시간봉: candle_start_at은 해당 4h 봉의 UTC 시작 시각 (예: 2월 12일 00:00 KST = 2월 11일 15:00 UTC)
$body = '{"market":"btc_4h","candle_start_at":"2026-02-11T15:00:00.000Z"}'
Invoke-RestMethod -Uri "http://localhost:3000/api/sentiment/settle" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body $body
```

- 이미 정산된 폴이면 `already_settled` 반환, DB는 변경 없음.
- 캔들이 없으면 에러 메시지로 "btc_ohlc에 해당 캔들이 없습니다" 반환.

---

## 투표 마감 시간 (4h / 1h / 15m)

- **1일봉(btc_1d)**: 당일 KST **12:00** 고정 마감.
- **4시간봉**: 현재 4h 봉 **시작 후 2시간**에 마감 (예: 00:00 봉 → 02:00 마감).
- **1시간봉**: 현재 1h 봉 **시작 후 30분**에 마감 (예: 14:00 봉 → 14:30 마감).
- **15분봉**: 현재 15m 봉 **시작 후 7분 30초**에 마감 (예: 14:00 봉 → 14:07:30 마감).

마감 시각이 지나면 투표·취소 불가, 해당 봉은 크론에서 수집 후 정산됩니다.

---

## 정산 결과별 의미

| status | 설명 | payout_history | 잔액 |
|--------|------|----------------|------|
| **settled** | 롱/숏 대결, 승자만 수령 | 당첨자만 기록 (bet_amount + payout_amount) | 승자: 원금+수령분, 패자: 차감 유지 |
| **draw_refund** | 동일가(무승부) | 없음 | 전원 원금 환불 |
| **one_side_refund** | 한쪽만 참여(롱만 or 숏만) | 당첨측에 payout_amount=0 기록 | 전원 원금 환불 |
| **invalid_refund** | 1명 이하 참여(무효판) | 없음 | 전원 원금 환불 |
| **already_settled** | 이미 정산됨 | (기존 그대로) | 변경 없음 |

**패자**는 payout 기록이 없고, 배팅한 포인트가 그대로 차감된 상태가 정상입니다.  
“payout 기록 없음 + 포인트 없어짐”이 **둘 다 패자**인 경우면 의도된 동작입니다.

---

## btc_1d에서 payout 없이 포인트만 사라진 경우 점검

### 1) 가능 원인

1. **정산이 아예 실행되지 않음**
   - Daily cron(KST 00:01) 실행 시 **해당 일봉이 btc_ohlc에 없었음**  
     → `"btc_ohlc에 해당 캔들이 없습니다"` 로 정산 스킵, `settled_at` 갱신 안 됨, 환불/당첨 없음.
   - 일봉 수집이 실패·지연되어 백필로 나중에 넣은 경우, **정산은 그때 한 번도 안 돌아간 상태**일 수 있음.

2. **폴을 찾지 못함**
   - `sentiment_polls` 조회는 `(market, candle_start_at)` 기준.
   - btc_1d: `candle_start_at` = 해당일 KST 00:00 → UTC `전일 15:00` (예: 2월 12일 일봉 = `2026-02-11T15:00:00.000Z`).
   - DB에 저장된 `candle_start_at`과 정산 시 사용한 값이 다르면 “폴을 찾을 수 없습니다”로 스킵.

3. **실제로 패자**
   - 롱/숏 대결에서 **진 쪽**이면 payout 없고 포인트만 차감되는 것이 정상.

### 2) DB로 확인할 것

```sql
-- 해당 일봉 폴 존재·정산 여부
SELECT id, poll_date, market, candle_start_at, settled_at,
       long_coin_total, short_coin_total
FROM sentiment_polls
WHERE market = 'btc_1d'
  AND candle_start_at = '2026-02-11T15:00:00.000Z';  -- 2월 12일 일봉 예시

-- 해당 폴 투표
SELECT user_id, choice, bet_amount FROM sentiment_votes WHERE poll_id = '위에서 나온 id';

-- 해당 폴 payout 기록
SELECT * FROM payout_history WHERE poll_id = '위에서 나온 id';

-- 일봉 OHLC 존재 여부
SELECT market, candle_start_at, open, close
FROM btc_ohlc
WHERE market = 'btc_1d' AND candle_start_at = '2026-02-11T15:00:00.000Z';
```

- `settled_at` 이 null 이면 → 정산이 한 번도 성공하지 않은 상태. 수동 재정산 가능.
- `settled_at` 이 있는데 payout_history에 해당 유저 없고, 투표는 있음 → 그 유저는 **패자**이면 정상.

### 3) 수동 재정산 (해당 일봉만)

**btc_ohlc에 해당 일봉이 들어온 뒤** 아래처럼 호출하면 됩니다.

```powershell
# 예: 2026-02-12 일봉만 재정산 (서버 인증 필요 시 헤더 추가)
$body = '{"poll_date":"2026-02-12","market":"btc_1d"}'
Invoke-RestMethod -Uri "http://localhost:3000/api/sentiment/settle" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body $body
```

- 이미 정산된 폴(`settled_at` 있음)이면 재정산하지 않고 `already_settled` 반환.
- `btc_ohlc`에 해당 캔들이 없으면 에러 메시지로 “캔들이 없습니다” 반환 → 일봉 수집/백필 먼저 확인.

---

## 15분봉(btc_15m) 정산 흐름 재확인

- 15분마다 cron이 **방금 마감된 15m봉 1개**만 수집 (`fetchKlinesKstAligned("btc_15m", 1)`).
- 수집 직후 `settlePoll("", "btc_15m", justClosed.candle_start_at)` 호출.
- `sentiment_polls`는 투표 시 `getCurrentCandleStartAt("btc_15m")`으로 생성되므로, 마감 시점의 `candle_start_at`과 일치해야 함.
- 정산 결과는 cron 응답 `data.settle`에 포함됨 (status, participant_count, winner_side 등).

15분 투표 후 같은 봉이 마감되면, 해당 cron 실행 로그/응답에서 `settle.status`와 참여 인원·승자 방향을 확인하면 됩니다.
