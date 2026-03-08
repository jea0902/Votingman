# 크론 수집 → 승리 판정까지 흐름

모든 시간봉(1d, 4h, 1h, 15m, 5m)이 **동일한 정산 로직**을 사용한다.  
5m 예시로 단계별 흐름을 적고, “전부 승리 판정이 안 될 때” 확인할 지점을 정리한다.

---

## 1. 크론 호출 (예: 5분봉)

- **진입**: `GET /api/cron/btc-ohlc-5m` (인증: `x-cron-secret` 또는 쿼리 `cron_secret`)
- **수집**:
  1. `getRecentCandleStartAts("btc_5m", 1)` → “방금 마감된 1개 봉”의 `candle_start_at` (UTC ISO)
  2. `fetchKlinesKstAligned("btc_5m", 1)` → 위 시각으로 Binance klines 요청 → `openTime` 기준 1개 캔들
  3. `parseCandle`: `candle_start_at = new Date(openTime).toISOString()`, `open`/`close` 등
  4. `upsertBtcOhlcBatch(rows)` → `btc_ohlc`에 `(market, candle_start_at)` 기준 upsert
- **정산 시각**:
  - `rows.length > 0` 이면  
    `candleStartAtIso = new Date(rows[0].candle_start_at).toISOString()`  
    → `settlePoll("", "btc_5m", candleStartAtIso)` 호출
  - 15m만 Binance 빈 응답 시 `getRecentCandleStartAts("btc_15m", 1)[0]` 으로 한 번 더 정산 시도

즉, **정산에 넘기는 시각 = 방금 수집한 그 봉의 `candle_start_at`(ISO)** 이다.

---

## 2. 정산 진입 (settlePoll)

- **인자**: `pollDate`, `market`(예: `"btc_5m"`), `candleStartAt`(크론에서 넘긴 ISO)
- **키 정규화**  
  `candleStartAtNorm = ensureUtcIsoString(candleStartAt)`  
  → 타임존 없으면 UTC로 해석, 최종적으로 ISO 문자열 하나로 통일

---

## 3. 폴 조회

- **한 번만** 조회:  
  `sentiment_polls` 에서  
  `market = "btc_5m"` AND `candle_start_at = candleStartAtNorm`  
  (15m/4h 전용 “정규화 재시도”는 제거된 상태)
- **못 찾으면** → `status: "already_settled"`, `error: "폴을 찾을 수 없습니다"` 반환, 여기서 종료.

---

## 4. OHLC 조회 (승/패 판정용 시가·종가)

- **사용 키**: 항상 `ohlcKey = candleStartAtNorm` (폴의 `candle_start_at`이 아님)
- **호출**: `getSettlementPricesFromOhlc(market, ohlcKey)`  
  → 내부에서 `getOhlcByMarketAndCandleStart(market, ohlcKey)` 호출

**getOhlcByMarketAndCandleStart (repository)**:

1. `exactKey = toUtcIso(candleStartAt)` (보통 그대로 ISO)
2. `btc_ohlc` 에서  
   `market = "btc_5m"` AND `candle_start_at = exactKey`  
   로 **한 건** 조회 (`.maybeSingle()`)
3. 있으면:  
   `reference_close = row.open`, `settlement_close = row.close`  
   반환 (시가=기준가, 종가=정산가)
4. 없으면:  
   - 1d만 예외: `key = getBtc1dCandleStartAtUtc(날짜)` 로 한 번 더 시도  
   - 4h/1h/15m/5m: **같은 키**(`candleStartAtUtc`)로 한 번 더 시도 후 없으면 `null`

**null 이면** 정산 쪽에서  
`reference_close == null || settlement_close == null`  
→ `error: "btc_ohlc에 해당 캔들이 없습니다. 크론 수집 후 다시 시도하세요."` 로 종료 (승/패 아님).

---

## 5. 무효 vs 승리 판정

- **참여 1명 이하** → 무효(환불)
- **한쪽만 배팅** (롱만 or 숏만) → 무효(환불)
- **OHLC 없음** → 위처럼 에러 반환 (승리 아님)
- **동일가**  
  `refRounded = round(reference_close, 2)`, `settleRounded = round(settlement_close, 2)`  
  → `refRounded === settleRounded` 이면 **동일가 무효**(환불)
- **그 외**  
  `settlement_close > reference_close` → long 승리, 아니면 short 승리  
  → 승자/패자별 VTC 정산 및 `payout_history` 기록

---

## “모든 시간봉이 승리 판정이 안 될 때” 점검

- **“무효”로 나오는 경우**  
  → 반드시 위 5번 중 하나를 탄다.  
  - 참여/한쪽 쏠림이면: `participantCount`, `longCoinTotal`, `shortCoinTotal`, `choices` 로그 확인.  
  - **동일가 무효**이면:  
    `reference_close` / `settlement_close` / `refRounded` / `settleRounded` / `ohlc_key` 로그 확인.  
    → 정산에 사용한 **그 봉**이 `btc_ohlc`에서 정말 `open ≠ close` 인지 DB에서 확인 필요.

- **“btc_ohlc에 해당 캔들이 없습니다”로 나오는 경우**  
  → `candle_start_at = exactKey` 로 **한 건도 안 나온다**는 뜻.  
  - 크론이 **넘긴 시각**과 **btc_ohlc에 저장된 시각**이 같은지 확인.  
  - Supabase/PostgreSQL이 `timestamptz`를 어떻게 저장/비교하는지 확인  
    (같은 시각이어도 문자열 포맷이 다르면 `.eq()`가 실패할 수 있음).

- **공통**  
  - 크론이 넘기는 `candleStartAtIso`  
  - `candleStartAtNorm` / `ohlcKey`  
  - `getOhlcByMarketAndCandleStart`에 들어가는 키와  
  - `btc_ohlc`에 실제로 들어간 `candle_start_at`  
  이 **같은 시각(동일 UTC)** 인지 한 번 더 맞추는 것이 중요하다.
