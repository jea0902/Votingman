# US Index Voting – usa_ohlc 기반 로드맵

> Yahoo Finance API(예: ^GSPC, ^NDX)로 S&P500/나스닥 지수 OHLC 수집 → DB `usa_ohlc` 저장 → 투표·마감·정산까지 코인(btc_ohlc)·한국( korea_ohlc )과 동일한 구조로 단계별 구현

---

## 0. 미국 증시 거래·휴장 기준 (2026년, NYSE 기준)

> 아래 내용은 2026년 미국 **뉴욕증권거래소(NYSE)**·나스닥 공통으로 쓰이는 정규장/휴장 기준을 요약한 것입니다. 브로커별 프리마켓/애프터마켓 세부 시간은 다를 수 있습니다.

### 0.1 정규장 및 시간외 (미 동부시간, Eastern Time)

| 구분 | 시간 (ET) | 비고 |
|------|----------|------|
| **정규장** | 09:30 ~ 16:00 | 기본 거래 시간 (NYSE·Nasdaq 공통) |
| **프리마켓(대표적 범위)** | 04:00 ~ 09:30 | 브로커별 상이, 공식 거래소 시간은 아님 |
| **애프터마켓(대표적 범위)** | 16:00 ~ 20:00 | 브로커별 상이, 공식 거래소 시간은 아님 |
| **조기 폐장(Early Close)** | 09:30 ~ 13:00 | 특정 전일/전후(추수감사절 다음 날, 크리스마스 이브 등) 1시 조기 폐장 |

- Votingman에서는 **정규장 09:30~16:00 ET**을 기준으로 OHLC를 사용하고, 프리/애프터마켓은 별도 고려하지 않는 것을 기본 전제로 한다.
- 조기 폐장일(예: 추수감사절 다음 날, 크리스마스 이브)은 **거래는 있는 날**이므로, OHLC 캔들은 존재하며 휴장일로 취급하지 않는다.

### 0.2 휴장일 (2026년 NYSE 기준)

미국 증시는 토·일요일과 아래 **공식 휴장일(Full-day Closure)**에 휴장한다. 2026년 NYSE 캘린더 기준:

| 날짜 (2026, ET 기준) | 휴장 명칭 |
|----------------------|-----------|
| 01-01 (목) | New Year's Day |
| 01-19 (월) | Martin Luther King Jr. Day |
| 02-16 (월) | Washington's Birthday (Presidents' Day) |
| 04-03 (금) | Good Friday |
| 05-25 (월) | Memorial Day |
| 06-19 (금) | Juneteenth National Independence Day |
| 07-03 (금) | Independence Day (Observed, 7/4 토요일 대체) |
| 09-07 (월) | Labor Day |
| 11-26 (목) | Thanksgiving Day |
| 12-25 (금) | Christmas Day |

조기 폐장(Early Close, 13:00 ET 마감)은 아래와 같다(참고용):

- 11-27 (금): Day after Thanksgiving – 13:00 조기 폐장
- 12-24 (목): Christmas Eve – 13:00 조기 폐장

Votingman 입장에서는:

- **Full-day 휴장일** → **OHLC 수집/투표 없음** (usa-market-holidays.json에 포함)
- **조기 폐장일** → **정규장 단축일**일 뿐, **거래일**이므로 OHLC 수집/투표는 수행 (usa-market-holidays.json에는 포함하지 않음)

### 0.3 현재 구현 범위 (로드맵 기준)

- **거래 시간**: 정규장 **09:30~16:00 ET**만 사용 (프리마켓/애프터마켓/조기 폐장 시간대의 세부 가격은 고려하지 않음).
- **휴장일**: 초기에는 **주말(토·일)** + **usa-market-holidays.json에 정의된 공식 휴장일(Full-day Closure)**만 판별.

### 0.4 캘린더 설정 도입 방법 (휴장일)

한국과 마찬가지로, “**오늘이 미국 증시 거래일인가?**”를 판별하기 위해 별도 **휴장 캘린더**를 둔다.

- 파일 방식(B방식) 권장: `src/data/usa-market-holidays.json`  
- 형식 예시:

```json
{
  "2026": [
    "2026-01-01",
    "2026-01-19",
    "2026-02-16",
    "2026-04-03",
    "2026-05-25",
    "2026-06-19",
    "2026-07-03",
    "2026-09-07",
    "2026-11-26",
    "2026-12-25"
  ]
}
```

- **출처 예시**:
  - NYSE 공식 캘린더: `https://www.nyse.com/trade/hours-calendars` 및 `ICE_NYSE_2026_Yearly_Trading_Calendar.pdf`
  - 서드파티 참고: CalendarLabs, MarketHoursNow 등

이 JSON을 기반으로:

- `src/lib/usa-ohlc/market-hours.ts` (예정)에
  - `isUsHoliday(date: Date): boolean`
  - `isUsTradingDay(date?: Date): boolean`  
  를 구현해, 일봉/4h Cron에서 **주말 + 공식 휴장일**에는 수집 생략.

---

## 1. Yahoo Finance 지원 범위 (참고)

| 구분 | 심볼 예시 | 비고 |
|------|-----------|------|
| **미국 지수** | ^GSPC(S&P500), ^NDX(Nasdaq100), ^DJI(Dow Jones) | 주요 지수 대상 |
| **미국 ETF** | SPY, QQQ, DIA | 지수 연동 ETF (확장 여지) |
| **개별 주식** | AAPL, MSFT, TSLA 등 | 필요 시 확장 가능 |
| **해외 지수/주식** | ^KS11, ^KQ11, ^N225, 7203.T 등 | 다른 로드맵(Korea 등)에서 사용 |

- 본 문서에서는 우선 **S&P500 지수(^GSPC)**를 기준으로 설명한다.  
  (필요 시 `usa_ohlc`에 market 구분을 두어 ^NDX, ^DJI 등으로 확장 가능.)

---

## 2. 목표 구조 요약

- **데이터 소스**: Yahoo Finance REST (^GSPC, 필요 시 ^NDX/^DJI 등)
- **저장**: 새 테이블 **`usa_ohlc`** (btc_ohlc, korea_ohlc와 분리)
- **흐름**: Cron으로 주기 수집 → DB 저장 → 투표 마감/정산은 `usa_ohlc` 기준
- **실시간**: WebSocket 없음. REST 폴링 + Cron 기반 “주기 갱신”.

### ⚠️ 미국 거래 시간 (코인·한국과의 차이)

- **정규장 기준**: 09:30~16:00 ET, 월~금.
- **조기 폐장일**: 09:30~13:00 ET (예: 추수감사절 다음 날). → 거래일이므로 OHLC는 존재.
- **휴장일**: §0.2에 언급된 10개 Full-day 휴장일 + 주말(토·일).

이에 따라:

- **일봉 Cron**: **주말/휴장일(usa-market-holidays.json)**에는 Yahoo 호출 없이 수집 생략.
- **4시간봉 Cron**(미국 도입 시): 한국과 마찬가지로 “정규장 시간과 겹치지 않는 캔들”은 수집 생략.
- 구현: `src/lib/usa-ohlc/market-hours.ts` (예정)에서 `isUsTradingDay`, `candleHadUsTrading` 등 제공.

---

## 3. 단계별 과제

한국 로드맵과 동일한 패턴으로, 미국용 `usa_ohlc` 파이프라인을 설계한다.

### Phase 1: DB 및 수집

| # | 과제 | 내용 | 산출물 |
|---|------|------|--------|
| 1.1 | **usa_ohlc 테이블 설계** | btc_ohlc, korea_ohlc와 유사 스키마. `market`, `candle_start_at`, `candle_start_at_us`, `open`, `high`, `low`, `close`, `updated_at`. UNIQUE(market, candle_start_at). RLS 정책. | `supabase/migrations/xxxx_usa_ohlc.sql` (예정) |
| 1.2 | **Yahoo → usa_ohlc 수집 유틸** | Yahoo Chart API(^GSPC 등) 호출 후 `usa_ohlc` 형식으로 변환·upsert. 시장별 candle_start_at 정렬 규칙 정의(ET 기준: 1d=정규장 마감 시각 기준, 4h=정규장 중 4시간 구간 등). | `src/lib/usa-ohlc/` (repository, yahoo-fetch, candle-utils) |
| 1.3 | **미국 휴장일 캘린더 (파일 방식)** | `src/data/usa-market-holidays.json`에 연도별 휴장일 정의(주말 제외). §0.2 기준: NYSE Full-day 휴장일. | `src/data/usa-market-holidays.json` |
| 1.4 | **Cron: 미국 지수 일봉 수집** | 매 영업일, 정규장 마감 후(예: 16:10 ET 또는 KST 기준 환산) ^GSPC 일봉 수집 → `usa_ohlc` upsert (market=sp500_1d). | `src/app/api/cron/usa-ohlc-daily/route.ts` |
| 1.5 | **(선택) 미국 지수 4h 수집** | 정규장 시간만 포함되도록 4시간 봉(또는 2시간/1시간 등) 집계. 정규장 외 시간은 수집 생략. | `src/app/api/cron/usa-ohlc-4h/route.ts` 등 |

### Phase 2: 투표·마감 연동

| # | 과제 | 내용 | 산출물 |
|---|------|------|--------|
| 2.1 | **미국 시장 목록 상수** | sp500_1d(, sp500_4h 등)를 “usa_ohlc 사용 시장”으로 정의. | `src/lib/constants/sentiment-markets.ts` |
| 2.2 | **Poll API: usa_ohlc 기준** | 미국 지수 시장은 `usa_ohlc`에서 open/close 조회. 목표가(시가)=open, 종가=close. settlement_status는 “마감 시각 경과 + usa_ohlc에 해당 candle_start_at 존재”로 판단. | `src/app/api/sentiment/poll/route.ts`, `src/lib/usa-ohlc/repository.ts` |
| 2.3 | **Vote API: 마감 시 캔들 검사** | 코인/한국과 동일하게 “캔들 마감 시각 경과 시 투표 거부” + “usa_ohlc에 해당 봉 있으면 거부”. | `src/app/api/sentiment/vote/route.ts` |
| 2.4 | **getCurrentCandleStartAt 확장** | sp500_1d, sp500_4h 등 미국 시장용 캔들 시작 시각 규칙(ET 정렬 → UTC 변환). | `src/lib/usa-ohlc/candle-utils.ts` |

### Phase 3: 정산

| # | 과제 | 내용 | 산출물 |
|---|------|------|--------|
| 3.1 | **정산 서비스: usa_ohlc 분기** | settlePoll(또는 호출부)에서 market가 미국 지수면 **usa_ohlc**에서 reference_close(open), settlement_close(close) 조회. 승/패/무효 판정 로직은 기존과 동일. | `src/lib/sentiment/settlement-service.ts` |
| 3.2 | **정산 Cron 연동** | 기존 “마감된 폴 정산” Cron이 미국 지수 폴도 처리하도록. usa_ohlc에 해당 candle_start_at 행이 있을 때만 정산 시도. | 기존 settlement cron 또는 통합 스케줄러 |

### Phase 4: 차트·부가

| # | 과제 | 내용 | 산출물 |
|---|------|------|--------|
| 4.1 | **차트 데이터 소스 선택** | (A) Yahoo 프록시 `/api/sentiment/usa-klines` 호출 + 주기 폴링. (B) 또는 usa_ohlc에서 조회 API 제공 후 차트가 DB 기반으로 표시. | `UsaIndexChart.tsx` (예정), `/api/sentiment/usa-klines` |
| 4.2 | **당일 결과/전적** | 미국 지수 시장의 당일 결과·전적 API가 usa_ohlc(또는 정산 결과) 기준으로 동작하도록. | `today-results`, `vote-history` 등 |

---

## 4. usa_ohlc 테이블 스키마 (안)

- korea_ohlc, btc_ohlc와 동일한 패턴을 따른다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 기본 키 |
| market | text | 예: `sp500_1d`, `sp500_4h` 등 |
| candle_start_at | timestamptz | UTC 기준 캔들 시작 시각 |
| open | numeric(18,4) | 시가 |
| close | numeric(18,4) | 종가 |
| high | numeric(18,4) | 고가 |
| low | numeric(18,4) | 저가 |
| created_at | timestamp (America/New_York 또는 UTC, 프로젝트 정책에 맞춤) | 레코드 생성 시각 |
| updated_at | timestamp | 레코드 갱신 시각 (트리거로 자동 갱신) |
| candle_start_at_us | timestamp | 미국 동부시간 기준 캔들 시작 시각(표시/디버깅용) |

- UNIQUE(market, candle_start_at).
- 인덱스: market, (market, candle_start_at desc) 등 btc_ohlc/korea_ohlc와 동일 패턴.

---

## 5. 체크리스트 (초기)

- [ ] 1.1 usa_ohlc 마이그레이션
- [ ] 1.2 Yahoo → usa_ohlc 수집 유틸
- [x] 1.3 미국 휴장일 파일(2026) 초안: `src/data/usa-market-holidays.json`
- [ ] 1.4 usa-ohlc-daily Cron
- [ ] 1.5 usa-ohlc-4h Cron (선택)
- [ ] 2.x Poll/Vote API usa_ohlc 연동
- [ ] 3.x 정산 서비스·Cron 미국 분기
- [ ] 4.x 차트/당일 결과

