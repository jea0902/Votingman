# 1일봉만 09:00 KST에 목표가가 바뀌는 이유

## 요약

- **4h / 1h / 15m**: “현재 봉”을 **KST 날짜·시각**으로 정함 → 봉이 바뀌는 시점이 **KST 기준** (15분봉 16:15, 1시간봉 17:00, 4시간봉 16:00 등).
- **1d**: “현재 봉”을 **UTC 날짜**로만 정함 → 봉이 바뀌는 시점이 **00:00 UTC = 09:00 KST** 한 번뿐.

즉, `candle_start_at`이 전부 UTC로 저장되는 것은 맞지만, **“지금 시점의 현재 봉”을 정할 때** 1일봉만 UTC 날짜를 쓰고, 나머지는 KST 날짜·시각을 쓰기 때문에 1일봉만 09:00에 바뀌는 것입니다.

---

## 코드 근거

`src/lib/btc-ohlc/candle-utils.ts` 의 `getCurrentCandleStartAt(market)`:

| market   | “현재 봉” 결정에 쓰는 값 | 사용 함수 |
|----------|--------------------------|-----------|
| btc_15m  | **KST** `dateStr` + `h`, `min` | `getBtc15mCandleStartAt(dateStr, h, slot15)` |
| btc_1h   | **KST** `dateStr` + `h`  | `getBtc1hCandleStartAt(dateStr, h)` |
| btc_4h   | **KST** `dateStr` + `slot` (0,4,8,...,20) | `getBtc4hCandleStartAt(dateStr, slot/4)` |
| **btc_1d** | **UTC** `uy`, `um`, `ud` (`new Date()` UTC) | `getBtc1dCandleStartAtUtc(\`${uy}-${um}-${ud}\`)` |

- `dateStr` = 위에서 `kst` 기준으로 만든 `"YYYY-MM-DD"` (KST 날짜).
- 4h/1h/15m은 모두 이 **KST 날짜 + KST 시/분**으로 “지금 진행 중인 봉”을 정합니다.
- **btc_1d만** `new Date()`의 **UTC** 연/월/일(`uy`, `um`, `ud`)로 “오늘”을 정해서, **00:00 UTC**가 되는 순간(즉 09:00 KST)에만 “현재 봉”이 바뀝니다.

그래서:

- 15분봉: 16:15 KST에 `dateStr`·시·분이 16:15로 바뀌면서 **현재 봉**이 바뀌고 → **이전 봉 종가 = 목표가**도 그때 갱신.
- 1일봉: 00:00 KST에는 UTC 날짜가 아직 전날이라 **현재 봉**이 그대로 → 목표가도 그대로. **09:00 KST**에 UTC 날짜가 바뀌면서 **현재 봉**이 바뀌고 → 그때 목표가가 갱신.

---

## “왜 1일봉만 그렇게 했는가”

- **Binance 1d 봉**이 **UTC 00:00** 기준이라, 차트/데이터와 맞추려고 **btc_1d의 “오늘 봉”도 UTC 날짜**로 맞춘 상태입니다.
- 그래서 “현재 1일 봉”이 바뀌는 시점만 **00:00 UTC = 09:00 KST**로 고정된 것이고,  
  4h/1h/15m처럼 “KST 00:00에 바뀌게” 하려면 **btc_1d도 “현재 봉”을 KST 날짜로 정하도록** 바꿔야 합니다 (그때는 1d 봉 경계가 KST 00:00이 되고, Binance 1d와는 봉 구간이 달라질 수 있음).

---

## 정리

- **1일봉만 09:00에 목표가가 바뀌는 이유**  
  → “현재 1일 봉”을 **UTC 날짜**로만 정하고 있기 때문 (`getCurrentCandleStartAt` 안에서 btc_1d만 `getBtc1dCandleStartAtUtc(오늘 UTC)` 사용).
- **15분봉 등은 바로 반영되는 이유**  
  → “현재 봉”을 **KST 날짜·시각**으로 정하고 있어서, 16:15 같은 KST 시점에 봉이 바뀌고, 그에 맞춰 이전 봉 종가(목표가)도 그 시점에 반영되기 때문입니다.
