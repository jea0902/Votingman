# 시장세(장세) 5단계 분류 TDD 계획서

보팅맨 6단계(**시장세 + 과거 데이터 시각화**) 구현을 위한 TDD 계획입니다.  
데이터 소스, 핵심 개념, 테스트 단위, 구현 우선순위를 정리합니다.

> 이 문서는 `plan.md`의 6단계 항목을 뒷받침하는 상세 TDD 문서입니다.

---

## 1. 목표 정리

### 1.1 비즈니스 목표

- 비트코인 BTC/USDT 시장에 대해:
  - **시장세(장세)** 를 5단계로 자동 분류한다.
    - 폭등장 · 상승장 · 횡보장 · 하락장 · 폭락장
  - **현재 시장세**와, 과거에 같은 시장세였을 때의:
    - **일봉 상승 비율(롱 당첨률)**,
    - **일봉 하락 비율(숏 당첨률)** 을 계산해 UI에 제공한다.

### 1.2 설계 원칙

1. **N일 수익률 기반**  
   - N일 수익률:  
     \[
     r_T = \frac{\text{close}_T - \text{close}_{T-N}}{\text{close}_{T-N}} \times 100
     \]
   - 기본 N은 30일을 우선 적용하고, 필요 시 20일과 비교 가능하도록 설계.

2. **히스토리 전체 + 최근 가중치**
   - Binance BTC/USDT 1일봉 전체(2017-08-17~오늘)에서 30일 수익률 분포를 얻는다.
   - 전체 히스토리를 보되, **최근 2~3년 데이터에 더 높은 가중치**를 두어 임계값을 결정한다.

3. **5구간은 “가중 분위수” 기반**
   - 단순 고정 수치(±3%, ±12%)가 아니라,
   - (가중) 분위수 20/40/60/80%를 활용해 **실제 데이터 분포를 반영한 5구간**으로 나눈다.

4. **중간 구간(횡보장)은 0% 중심**
   - **0% 수익률이 항상 중앙 구간(횡보장)에 포함되도록** 설계한다.
   - 구현상:
     - 먼저 \(|r|\)에 대한 가중 분위수 20% 지점 \(a\)를 찾고,
     - 횡보장을 `[-a, +a]` 로 두어 0을 포함하게 만든 뒤,
     - 음수/양수 양쪽을 각각 2구간(하락·폭락, 상승·폭등)으로 다시 나눈다.

5. **계산 비용 최소화**
   - 히스토리 전체에서 매번 다시 계산하지 않고,
   - **배치/cron이 주기적으로(예: 1일 1회)** 임계값과 통계를 미리 계산해두고,
   - 런타임(홈 화면)은 **캐시된 결과**만 읽는다.

---

## 2. 데이터 모델 및 소스

### 2.1 외부 데이터 소스 (Binance)

- API: `GET https://api.binance.com/api/v3/klines`
- 파라미터:
  - `symbol=BTCUSDT`
  - `interval=1d`
  - `startTime`, `endTime`, `limit` (최대 1000)
- 응답:
  - 각 봉: `[ openTime, open, high, low, close, volume, ... ]`

### 2.2 내부 DB 테이블 (초기 설계)

**(1) BTC 일봉 테이블 – `btc_daily_ohlc` (가칭)**

- 컬럼 예시:
  - `date` (DATE, PK) — KST 기준 날짜
  - `open` (NUMERIC)
  - `high` (NUMERIC)
  - `low` (NUMERIC)
  - `close` (NUMERIC)
  - `source` (TEXT, 예: 'binance')

**(2) 시장세 통계 테이블 – `btc_market_regime_stats` (가칭)**

- 컬럼 예시:
  - `as_of_date` (DATE, PK) — 해당 통계를 계산한 기준 날짜
  - `n_days` (INT) — 수익률 기간 (예: 30)
  - `neutral_band_min` (NUMERIC) — 횡보장 하한 (예: -2.5)
  - `neutral_band_max` (NUMERIC) — 횡보장 상한 (예: +2.5)
  - `fall_threshold` (NUMERIC) — 폭락/하락 경계
  - `rise_threshold` (NUMERIC) — 상승/폭등 경계
  - `regime_long_win_rate` (JSONB) — 각 RegimeLabel별 { regime, longWinRatePct, shortWinRatePct, sampleCount }

> 1차 구현에서는 DB를 바로 만들지 않고, **순수 함수 + Binance API 기반 계산**만 먼저 구현할 수 있다.  
> 이후, 동일 로직을 DB 기반 배치로 옮기는 방향으로 확장한다.

---

## 3. 핵심 순수 함수 설계 (테스트 우선 대상)

아래 함수들은 **I/O 없는 순수 함수**로 설계하고, Jest 등으로 단위 테스트를 작성한다.

### 3.1 30일 수익률 계산

```ts
type Candle = { date: string; open: number; close: number };

function computeNDaysReturns(candles: Candle[], n: number): number[]; // 길이 = candles.length, 앞 n개는 NaN 또는 null
```

**테스트 아이디어**

- 고정된 10~15개의 close 시퀀스를 만들어:
  - 수동으로 계산한 N일 수익률과 결과 배열이 일치하는지 검증.
  - 상승/하락/무변화 케이스를 모두 포함.

### 3.2 가중치 계산 (최근일수 가중)

```ts
function computeRecencyWeights(length: number, halfLifeDays: number): number[];
```

- 인덱스가 클수록(최근일수일수록) 더 큰 가중치를 갖는다.
- 예: `weight[i] = exp(-(daysAgo)/halfLife)`, `daysAgo = (length - 1 - i)`.

**테스트 아이디어**

- 길이 5일, halfLife=2일 등으로:
  - 뒤로 갈수록(최근일수) 값이 증가하는지,
  - 전부 양수인지,
  - 합이 1로 정규화되도록 구현했다면 합이 1인지 등을 검증.

### 3.3 가중 분위수 계산

```ts
function weightedQuantile(values: number[], weights: number[], q: number): number;
```

- `q` ∈ (0, 1), 예: 0.2, 0.4, 0.6, 0.8.
- 구현:
  - `values`와 `weights`를 value 기준 오름차순 정렬.
  - 누적 가중합을 구해, 전체 가중합의 `q` 지점에 해당하는 value를 반환.

**테스트 아이디어**

- **동일 가중치**일 때:
  - [1, 2, 3, 4, 5], 모두 weight=1 → q=0.5일 때 3 근처가 나오는지.
- **한쪽에 가중치 몰림**:
  - [1, 100], weight=[0.9, 0.1] → q=0.5일 때 1 근처인지.

### 3.4 5구간 임계값 계산 (0% 중심)

```ts
type RegimeThresholds = {
  neutralMin: number; // 횡보장 하한
  neutralMax: number; // 횡보장 상한
  fallBoundary: number; // 폭락/하락 경계값 (음수)
  riseBoundary: number; // 상승/폭등 경계값 (양수)
};

function computeRegimeThresholds(
  returns: number[],
  weights: number[]
): RegimeThresholds;
```

**알고리즘 요약**

1. `absReturns = returns.map(r => Math.abs(r))`.
2. `a = weightedQuantile(absReturns, weights, 0.2)`  
   → 전체 가중치 중 약 20%가 \(|r| ≤ a\) 안에 있도록.
3. 횡보장 구간: `neutralMin = -a`, `neutralMax = +a`.
4. 음수 쪽: `negReturns = returns.filter(r < neutralMin)`  
   - 이 집합에 대해 q=0.5 가중 분위수 `t_neg`을 구함.  
   - 폭락장: (-∞, t_neg), 하락장: [t_neg, neutralMin).
5. 양수 쪽: `posReturns = returns.filter(r > neutralMax)`  
   - 이 집합에 대해 q=0.5 가중 분위수 `t_pos`를 구함.  
   - 상승장: (neutralMax, t_pos], 폭등장: (t_pos, +∞).

**테스트 아이디어**

- 대칭적인 분포(예: -10~-1, -1~1, 1~10)와 약간 치우친 분포 양쪽 모두에서:
  - `neutralMin < 0 < neutralMax` 인지,
  - `fallBoundary`는 음수, `riseBoundary`는 양수인지,
  - 단조관계: `fallBoundary < neutralMin < 0 < neutralMax < riseBoundary` 가 항상 유지되는지.

### 3.5 수익률 → RegimeLabel 매핑

```ts
type RegimeLabel = "폭등장" | "상승장" | "횡보장" | "하락장" | "폭락장";

function classifyRegime(
  r: number,
  thresholds: RegimeThresholds
): RegimeLabel;
```

- 규칙:
  - `r < fallBoundary` → 폭락장
  - `fallBoundary ≤ r < neutralMin` → 하락장
  - `neutralMin ≤ r ≤ neutralMax` → 횡보장
  - `neutralMax < r ≤ riseBoundary` → 상승장
  - `r > riseBoundary` → 폭등장

**테스트 아이디어**

- 경계값 바로 위/아래 수치에 대해 기대하는 레이블이 정확히 나오는지 검증.

### 3.6 과거 같은 장세의 롱/숏 당첨률

```ts
type RegimeStats = {
  regime: RegimeLabel;
  longWins: number;
  shortWins: number;
  total: number;
};

type RegimeStatsResult = {
  regime: RegimeLabel;
  longWinRatePct: number;
  shortWinRatePct: number;
  sampleCount: number;
}[];

function computeRegimeWinRates(
  candles: CandleWithRegime[]
): RegimeStatsResult;
```

- `CandleWithRegime`는 `{ date, open, close, regime }`.
- 각 장세별로:
  - `close > open` → longWins++
  - `close < open` → shortWins++
  - `close == open` → 무시 or 반반 (하나로 정책 통일)
- 퍼센트는 소수 1자리까지 반올림.

**테스트 아이디어**

- 작은 샘플(10~20일봉)을 손으로 레이블링해서:
  - 각 장세마다 long/short 비율이 기대값과 정확히 일치하는지 검증.

---

## 4. 통합 흐름 (현재 `market-regime.ts` 리팩터링 가이드)

### 4.1 현재 구조 요약

- Binance 1d 봉을 최대 400개 가져와,
  - 고정 임계값(±3%, ±12%)으로 RegimeLabel을 붙이고,
  - 장세별로 롱/숏 당첨률을 집계하는 구조.

### 4.2 목표 구조

1. (초기) Binance API 기반:
   - `fetchBtcDailyKlines()` → `DailyCandle[]` (전체 혹은 최근 N년).
   - `computeNDaysReturns()` 로 30일 수익률 벡터 생성.
   - `computeRecencyWeights()` 로 가중치 생성.
   - `computeRegimeThresholds()` 로 임계값 계산.
   - 각 일자별 수익률에 `classifyRegime()` 을 적용해 `regime` 필드 채움.
   - `computeRegimeWinRates()` 로 장세별 롱/숏 비율 계산.

2. (이후) DB + 배치로 이전:
   - Binance → Supabase `btc_daily_ohlc` 적재 cron.
   - 별도 cron이 `btc_market_regime_stats` 테이블에 임계값/통계를 계산·업데이트.
   - 런타임은 `computeMarketRegime()`에서 DB 캐시만 조회.

---

## 5. 테스트 우선 순위

1. **순수 함수 4개**  
   - `computeNDaysReturns`  
   - `computeRecencyWeights`  
   - `weightedQuantile`  
   - `computeRegimeThresholds` + `classifyRegime`
2. **장세별 롱/숏 집계**  
   - `computeRegimeWinRates`
3. **통합 함수**  
   - `computeMarketRegime("btc")` 가:
     - 현재 시장세 라벨,
     - 현재 30일 수익률,
     - 각 장세별 롱/숏 비율과 샘플 수
     를 일관된 스키마로 반환하는지.

이 순서대로 테스트를 작성하고, 하나씩 Green을 만든 뒤,  
마지막에 `src/lib/sentiment/market-regime.ts` 를 완전히 새 구조로 교체하는 것을 목표로 한다.

