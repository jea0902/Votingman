# 목표가가 "—"로 나오는 원인

투표 상세 페이지에서 목표가가 계산되지 않아 **"—"**로 보일 수 있는 **원초적인 이유** 정리.  
목표가 계산 방식은 [price-to-beat-calculation.md](./price-to-beat-calculation.md) 참고.

---

## 1. btc_ohlc에는 "마감된 봉"만 들어감

- 크론(btc-ohlc-daily, 4h, 1h, 15m)은 **방금 마감된 캔들**만 수집해 `btc_ohlc`에 넣습니다.
- 투표 상세 페이지는 **지금 진행 중인 봉**에 해당하는 폴을 보여주고, 그 봉의 `candle_start_at`으로 목표가를 조회합니다.
- 따라서 **진행 중인 봉**은 아직 DB에 없어서, 1단계 `getOhlcByMarketAndCandleStart(market, candle_start_at)`는 대부분 **null**을 반환합니다.
- 이 경우 2단계로 **Binance Klines API**에서 해당 봉 1개의 `open`을 조회해 목표가를 채우도록 되어 있습니다.

## 2. Binance fallback이 실패하는 경우 (BTC 시장인데 —)

- **btc_ohlc에 없을 때** Binance `fetchOpenPriceForCandle(market, candleStartAt)`를 호출합니다.
- 아래처럼 되면 fallback이 실패하고, 목표가는 null → 화면에 "—"로 표시됩니다.
  - **네트워크/타임아웃**: Binance 요청 실패
  - **API 오류**: 451 지역 제한, rate limit, 5xx 등
  - **응답 형식**: klines 배열이 비어 있거나 open이 없음
- 서버 로그에는 `[sentiment/poll] fetchOpenPriceForCandle error:` 로 남으므로, 이때 에러 원인을 확인하면 됩니다.

## 3. ndq / sp500 / kospi / kosdaq

- 목표가(price_open)를 채우는 로직은 **BTC 시장(btc_1d, btc_4h, btc_1h, btc_15m)** 에만 있습니다.
- ndq, sp500, kospi, kosdaq은 `btc_ohlc`와 Binance fallback을 사용하지 않아, **현재 구현에서는 목표가를 항상 표시하지 않습니다** (— 고정).

---

## 요약

| 상황 | 원인 |
|------|------|
| BTC 시장인데 가끔 — | btc_ohlc에 해당 봉 없음(진행 중 봉) + Binance fallback 실패(네트워크/API 오류). 서버 로그 `fetchOpenPriceForCandle error` 확인. |
| BTC 시장인데 특정 시장만 — | 해당 시장 크론 지연/실패로 btc_ohlc에 데이터가 늦게 들어오거나, Binance fallback 실패. |
| ndq/sp500/kospi/kosdaq | 목표가 조회 로직이 없음(다른 데이터 소스 미구현). |

---

## 관련 코드

- 목표가 조회: `GET /api/sentiment/poll?market=...` → `src/app/api/sentiment/poll/route.ts`
- 1단계: `getOhlcByMarketAndCandleStart` → `src/lib/btc-ohlc/repository.ts`
- 2단계(fallback): `fetchOpenPriceForCandle` → `src/lib/binance/btc-klines.ts`
