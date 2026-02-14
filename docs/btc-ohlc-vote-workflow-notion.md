# 비트코인 봉별 투표·정산 워크플로우 (노션용 요약)

## 1. 공통 워크플로우 (1일봉·4시간봉·1시간봉·15분봉 공통)

전체적으로 **같은 흐름**이다. 시장(market)과 **주기·마감 시각·크론 스케줄**만 다름.

```
[투표 오픈] → [폴 조회/생성] → [사용자 투표(롱/숏 + 포인트)] → [투표 마감] → [OHLC 수집] → [정산] → [당첨/환불 반영]
```

### 단계별 공통 로직

| 단계 | 설명 |
|------|------|
| **1. 폴 식별** | 모든 시장은 **(market, candle_start_at)** 으로 폴을 구분한다. `candle_start_at`은 해당 봉의 **시작 시각(UTC ISO)**. |
| **2. 폴 조회/생성** | 투표 요청 시 `getOrCreateTodayPollByMarket(market)` 호출. **현재 진행 중인 봉**의 `candle_start_at`으로 `sentiment_polls`에서 조회, 없으면 생성. |
| **3. 투표** | 사용자가 롱/숏 선택 + 배팅 금액. `sentiment_votes`에 저장, `users.voting_coin_balance`에서 차감, `sentiment_polls`의 long_coin_total/short_coin_total 등 갱신. |
| **4. 투표 마감** | 마감 시각이 지나면 투표·취소 불가. (마감 시각만 시장별로 다름.) |
| **5. OHLC 수집** | 크론이 **방금 마감된 봉 1개**를 Binance에서 가져와 `btc_ohlc`에 upsert. 저장 시 **open** = 이전 봉 종가(참조가), **close** = 이 봉 종가(정산가). |
| **6. 정산** | `settlePoll(poll_date 또는 candle_start_at, market)` 호출. `sentiment_polls`에서 (market, candle_start_at)으로 폴 조회 → `btc_ohlc`에서 **reference_close(open)** vs **settlement_close(close)** 비교 → 롱 승/숏 승/동일가(무승부)/한쪽만 참여/1명 이하 등에 따라 잔액·payout_history·settled_at 처리. |

### 정산 판정 (공통)

- **reference_close** = 해당 봉의 시가(open) = 이전 봉 종가  
- **settlement_close** = 해당 봉의 종가(close)  
- `settlement_close > reference_close` → **롱 승**  
- `settlement_close < reference_close` → **숏 승**  
- `settlement_close === reference_close` → **무승부** → 전원 원금 환불  
- 한쪽만 참여(롱만 or 숏만) → 전원 원금 환불  
- 1명 이하 참여 → 전원 원금 환불(무효판)

---

## 2. 시장별 차이 (1일봉 vs 4시간봉 vs 1시간봉 vs 15분봉)

| 항목 | btc_1d (1일봉) | btc_4h (4시간봉) | btc_1h (1시간봉) | btc_15m (15분봉) |
|------|----------------|------------------|------------------|------------------|
| **봉 주기** | 1일 (KST 00:00~다음날 00:00) | 4시간 (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 KST) | 1시간 (00:00~23:00 KST) | 15분 (00:00, 00:15, 00:30, 00:45, … KST) |
| **투표 마감** | 당일 KST **20:30** 고정 | 현재 4h 봉 **시작 후 2시간** | 현재 1h 봉 **시작 후 30분** | 현재 15m 봉 **시작 후 7분 30초** |
| **폴의 candle_start_at** | 해당일 KST 00:00 → UTC 전일 15:00 (예: 2/12 일봉 = 2/11 15:00 UTC) | 해당 4h 구간 시작 시각 (UTC) | 해당 1h 구간 시작 시각 (UTC) | 해당 15m 구간 시작 시각 (UTC) |
| **OHLC 수집 크론** | 매일 KST **00:01** (daily) | 4시간마다 (cron-job.org 등) | 1시간마다 | 15분마다 |
| **정산 호출 시점** | daily 크론에서 **어제 일봉** 정산 | 4h 크론에서 수집 직후 **방금 마감된 봉** 정산 | 1h 크론에서 수집 직후 **방금 마감된 봉** 정산 | 15m 크론에서 수집 직후 **방금 마감된 봉** 정산 |
| **정산 시 입력** | `poll_date` (예: 2026-02-12) | `candle_start_at` (해당 4h 봉 UTC 시작) | `candle_start_at` (해당 1h 봉 UTC 시작) | `candle_start_at` (해당 15m 봉 UTC 시작) |

---

## 3. 데이터 흐름 요약

- **sentiment_polls**: (market, candle_start_at) unique. poll_date는 KST 기준 표기/조회용.  
- **sentiment_votes**: poll_id, user_id, choice(long/short), bet_amount.  
- **btc_ohlc**: (market, candle_start_at) unique. open, close, high, low. 정산 시 open→reference_close, close→settlement_close.  
- **payout_history**: 정산 시 당첨자(및 한쪽만 참여 시 해당 측)만 기록. 패자는 기록 없음(포인트 차감 유지).  
- **users.voting_coin_balance**: 투표 시 차감, 정산 시 당첨/환불에 따라 가산 또는 복구.

---

## 4. 한 줄 요약

**모든 봉은 “(market, candle_start_at)으로 폴을 만들고 → 마감 전에 투표 → 봉 마감 후 OHLC 1개 수집 → reference_close vs settlement_close로 정산”** 이고, 1일봉만 마감 시각이 당일 20:30 고정이고, 4h/1h/15m은 **현재 봉 시작 + 주기 절반**에 마감·그 후 크론으로 수집·정산한다.
