# 코스피/코스닥 투표 – korea_ohlc 기반 로드맵

> Yahoo Finance API(^KS11, ^KQ11)로 OHLC 수집 → DB `korea_ohlc` 저장 → 투표·마감·정산까지 코인(btc_ohlc)과 동일한 구조로 단계별 구현

---

## 0. 한국 증시 거래·휴장 기준 (2026년)

> 아래 내용은 2026년 기준 유가증권·코스닥 공통이며, 증권사·거래 환경에 따라 시간외 거래 시간은 다를 수 있습니다. ATS·시간 확대는 추진 중인 예정 사항을 포함합니다.

### 0.1 정규장 및 시간외 (2026년 기준)

| 구분 | 시간 (KST) | 비고 |
|------|------------|------|
| **정규장** | 09:00 ~ 15:30 | 기본 거래 시간 |
| **장 시작 전 시간외** | 08:30 ~ 09:00 | 전일 종가 기준 |
| **장 종료 후 시간외** | 15:40 ~ 18:00 | 당일 종가 기준 |
| **연초 개장일** | 10:00 개장 | 예: 2026년 1월 2일 |

### 0.2 대체거래소(ATS) 및 거래 시간 확대 (추진 중)

- **2026년 6월부터** 넥스트레이드(대체거래소) 도입 및 거래 시간 확대 예정.
- **프리마켓(예정)**: 07:00 ~ 08:00  
- **정규장(ATS)**: 08:00 ~ 20:00 (기존 09:00~15:30 포함, 12시간)  
- **애프터마켓(예정)**: 16:00 ~ 20:00  
- 구현 시점에 맞춰 `market-hours` 및 Cron 수집 구간을 확장할 예정.

### 0.3 휴장일

한국 주식 시장(코스피·코스닥)은 아래 요일에 휴장합니다.

| 구분 | 설명 |
|------|------|
| **주말** | 토요일, 일요일 |
| **법정 공휴일** | 법정 공휴일 전부 |
| **대체 공휴일** | 공휴일이 주말과 겹칠 때 대체로 지정된 휴일 |
| **연말 휴장일** | 매년 **12월 31일** (30일까지 거래, 31일 결제/정산) |
| **근로자의 날** | **5월 1일** (노동절) |
| **기타** | 정부 지정 임시 공휴일, 시장 관리상 휴장으로 지정된 날 |

휴장일에는 주문·결제·입출금이 1영업일 순연됩니다.

### 0.4 현재 구현 범위 (로드맵 기준)

- **거래 시간**: 정규장 **09:00~15:30 KST**만 사용. (연초 10:00 개장, 시간외, ATS는 미반영)
- **휴장일**: **주말(토·일)**만 판별. 법정 공휴일·대체 공휴일·12월 31일·5월 1일·임시 휴장일은 별도 휴장 캘린더 도입 시 반영 예정.

### 0.5 캘린더 설정 도입 방법 (휴장일)

휴장일을 반영하려면 “**오늘이 거래일인가?**”를 판별하는 **휴장 캘린더**가 필요하다. 아래 중 하나로 도입하면 된다.

| 방식 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A. 정적 상수** | 연도별 휴장일을 코드 상수(`string[]`)로 두고, `isTradingDayKST(date)`에서 주말 + 이 목록 제외 | 구현 단순, 배포만으로 반영 | 매년 코드 갱신 필요 |
| **B. 데이터 파일** | `src/data/korea-market-holidays.json` 등에 연도별 `["YYYY-MM-DD", ...]` 저장 후 코드에서 읽기 | 코드 수정 없이 날짜만 갱신 가능 | 파일 배포 필요 |
| **C. DB 테이블** | `korea_market_holidays (date PRIMARY KEY)` 같은 테이블에 휴장일 저장, Cron/API에서 조회 | 관리자·배치로 유연하게 관리 | 스키마·운영 부담 |
| **D. 외부 API** | 공휴일 API(한국 공휴일 등) 호출 | 자동 반영 | 의존성·지연·가용성 이슈 |

**권장**: 먼저 **A 또는 B**로 시작.

#### 휴장일 목록 출처 (B방식 JSON 채울 때 참고)

| 출처 | 설명 | 용도 |
|------|------|------|
| **한국거래소(KRX) 공지** | [krx.co.kr](https://www.krx.co.kr) → 공시/공지에서 연도별 **거래일정·휴장일** 공지. 증시 휴장의 **최종 기준**. | 연말(12/31), 연초 개장일, 임시 휴장 등 거래소만의 휴장은 여기서 확인 후 JSON에 수동 반영. |
| **공공데이터포털 – 한국천문연구원 특일 정보** | [data.go.kr](https://www.data.go.kr/data/15012690/openapi.do). REST API(연도·월별 조회). **법정 공휴일·대체공휴일** 제공. 인증키 발급 필요. | 법정 공휴일·대체공휴일을 API로 조회해 JSON을 만들거나, 응답을 캐시해 사용. (12/31·5/1 포함 여부는 API 문서 확인) |
| **GitHub `holidays-kr`** | [hyunbinseo/holidays-kr](https://github.com/hyunbinseo/holidays-kr). 대한민국 공휴일을 CSV/JSON/ICS로 가공. MIT. | 연도별 JSON: `https://raw.githubusercontent.com/hyunbinseo/holidays-kr/main/public/YYYY.json` (예: [2026.json](https://raw.githubusercontent.com/hyunbinseo/holidays-kr/main/public/2026.json)). 객체 형식 `{ "YYYY-MM-DD": ["명칭"], ... }` → 날짜 키만 추출 후, **5/1(근로자의 날)·12/31(연말 휴장)**은 수동 추가. |

**B방식 권장 절차**: (1) 공공데이터 API 또는 holidays-kr로 해당 연도 **법정·대체 공휴일** 목록 확보. (2) KRX 공지로 **12월 31일**, **선거일**, **임시 휴장** 등 추가. (3) `{ "2026": ["2026-01-01", "2026-05-01", ...], "2027": [...] }` 형태로 저장.

1. **휴장일 목록 정의**  
   - §0.3 기준: 법정 공휴일, 대체 공휴일, **12월 31일**, **5월 1일**, (가능하면) 임시 휴장일.  
   - 위 출처를 참고해 연도별 `YYYY-MM-DD` 배열 또는 `{ "2026": ["2026-01-01", "2026-05-01", ...], "2027": [...] }` 형태로 유지.

2. **코드에서 사용**  
   - `src/lib/korea-ohlc/market-hours.ts`에  
     - `isHolidayKST(date: Date): boolean` (해당 KST 날짜가 휴장 목록에 있거나 12/31, 5/1 규칙에 해당하면 true)  
     - `isTradingDayKST(date?: Date): boolean` (주말이 아니고 휴장일이 아니면 true)  
   - 일봉 Cron에서는 현재 `isNowWeekdayKST()` 대신 **`isTradingDayKST(new Date())`** 사용하면, 주말 + 휴장일 모두 수집 생략.

3. **갱신**  
   - A: 매년 연초에 해당 연도 휴장일을 상수에 추가 후 배포.  
   - B: JSON 파일만 갱신 후 배포(또는 빌드 시 포함).

4. **1시간봉 Cron**  
   - 매 시간(예: 정각) Cron이 `/api/cron/kospi-ohlc-hourly`, `/api/cron/kosdaq-ohlc-hourly`를 호출.  
   - 라우트 내부에서 `isTradingDayKST(오늘)`로 **주말/휴장일** 필터링 후, `isTradingHourKST(현재시각)`으로 **정규장(예: 09~15시)** 시간대만 실제 수집.  
   - 야간·휴장 시간대 호출은 모두 “영업일 아님/장 시간 외, 수집 생략”으로 처리하여 Yahoo 호출·DB upsert를 막는다.

---

## 1. Yahoo Finance 지원 범위 (참고)

| 구분 | 심볼 예시 | 비고 |
|------|-----------|------|
| **코스피 지수** | ^KS11 | 사용 예정 |
| **코스닥 지수** | ^KQ11 | 사용 예정 |
| **국내 개별주식** | 005930.KS (삼성전자), 035720.KQ (카카오) | .KS=코스피, .KQ=코스닥 |
| **해외 주식/지수** | AAPL, MSFT, ^GSPC(S&P500), 7203.T(도요타) 등 | 전 세계 거래소 지원 |

- 본 로드맵에서는 **지수(^KS11, ^KQ11)**만 대상. 국내/해외 개별주식 확장은 이후 단계에서 검토 가능.

---

## 2. 목표 구조 요약

- **데이터 소스**: Yahoo Finance REST (^KS11, ^KQ11)
- **저장**: 새 테이블 **`korea_ohlc`** (btc_ohlc와 분리)
- **흐름**: Cron으로 주기 수집 → DB 저장 → 투표 마감/정산은 `korea_ohlc` 기준 (코인과 동일 패턴)
- **실시간**: WebSocket 없음. REST 폴링으로 “주기 갱신”만 구현 (선택)

### ⚠️ 한국 거래 시간 (코인과의 차이)

- **상세 기준**: **§0 한국 증시 거래·휴장 기준 (2026년)** 참고 (정규장 09:00~15:30, 시간외, 연초 10:00 개장, ATS 예정, 휴장일 정의).
- **코인**: 24시간 거래 → Cron은 설정된 주기대로 실행해도 됨.
- **한국 주식(코스피/코스닥)**: 정규장 **평일 09:00~15:30 KST** 기준. 휴장일은 §0.3 참고.
- 이에 따라 **반드시** 다음을 적용함:
  - **일봉 Cron**: **주말/휴장일**에는 Yahoo 호출 없이 수집 생략 (200 + `주말/휴장일, 수집 생략`). 현재는 주말(토·일)만 판별; 법정 공휴일·12/31·5/1 등은 휴장 캘린더 도입 시 반영.
  - **4시간봉 Cron**: **장 시간과 겹치지 않는 캔들**이면 수집 생략 (예: UTC 08/12/16/20 구간은 17~09시 KST → 장 종료 후이므로 생략).
- 구현: `src/lib/korea-ohlc/market-hours.ts` (`isWeekdayKST`, `candleHadKoreanTrading`, `isNowWeekdayKST`).

---

## 3. 단계별 과제

### Phase 1: DB 및 수집

| # | 과제 | 내용 | 산출물 |
|---|------|------|--------|
| 1.1 | **korea_ohlc 테이블 생성** | btc_ohlc와 유사 스키마. `market`, `candle_start_at`, `candle_start_at_kst`, `open`, `high`, `low`, `close`, `updated_at`. UNIQUE(market, candle_start_at). RLS 정책. | `supabase/migrations/xxxx_korea_ohlc.sql` |
| 1.2 | **Yahoo → korea_ohlc 수집 유틸** | Yahoo Chart API(^KS11, ^KQ11) 호출 후 `korea_ohlc` 형식으로 변환·upsert. 시장별 candle_start_at 정렬 규칙 정의(KST 기준: 1d=해당 거래일 00:00(UTC) 시작 → 09:00~15:30 KST 장 전체를 포괄하는 일봉, 1h=정규장 1시간 단위(예: 09~10, 10~11, …, 14~15)). | `src/lib/korea-ohlc/` (repository, yahoo-fetch, candle-utils) |
| 1.3 | **Cron: 코스피 일봉 수집** | 매 영업일 **KST 15:30 직후**(예: 15:30~15:40 사이) 실행. **당일** ^KS11 일봉 수집 → `korea_ohlc` upsert (market=kospi_1d). 이 값으로 “오늘 하루 종가” 1일봉 투표를 정산. | `src/app/api/cron/kospi-ohlc-daily/route.ts` (아래 URL·스케줄 참고) |
| 1.4 | **Cron: 코스피 1시간봉 수집** | **KST 10:00, 11:00, 12:00, 13:00, 14:00, 15:00**(10~15시 정각)에만 실행. 각 시점에서 직전 1시간봉(09~10, 10~11, …, 14~15 KST)을 대상으로 ^KS11 1시간봉 수집 → `korea_ohlc` (market=kospi_1h). | `src/app/api/cron/kospi-ohlc-1h/route.ts` |
| 1.5 | **(선택) 코스닥 일봉/1시간봉 수집** | ^KQ11 동일 패턴. kospi → kosdaq 시장 코드만 추가. | `korea_ohlc` market=kosdaq_1d, kosdaq_1h |

### Phase 2: 투표·마감 연동

| # | 과제 | 내용 | 산출물 |
|---|------|------|--------|
| 2.1 | **한국 시장 목록 상수** | kospi_1d, kospi_1h(, kosdaq_1d, kosdaq_1h)를 “korea_ohlc 사용 시장”으로 정의. | `src/lib/constants/sentiment-markets.ts` 등 |
| 2.2 | **Poll API: korea_ohlc 기준** | kospi/kosdaq 시장은 `getOhlcByMarketAndCandleStart` 대신 **korea_ohlc** 조회. 목표가(시가)=open, 종가=close. settlement_status는 “마감 시각 경과 + korea_ohlc에 해당 candle_start_at 존재”로 판단. | `src/app/api/sentiment/poll/route.ts`, `src/lib/korea-ohlc/repository.ts` (getKoreaOhlcByMarketAndCandleStart) |
| 2.3 | **Vote API: 마감 시 캔들 검사** | 코인처럼 “캔들 마감 시각 경과 시 투표 거부” + “korea_ohlc에 해당 봉 있으면 거부”. | `src/app/api/sentiment/vote/route.ts` |
| 2.4 | **getCurrentCandleStartAt 확장** | kospi_1d, kospi_1h(, kosdaq_1d, kosdaq_1h)용 캔들 시작 시각 규칙(KST 정렬, 1시간 단위). | `src/lib/btc-ohlc/candle-utils.ts` 또는 `src/lib/korea-ohlc/candle-utils.ts` |
| 2.5 | **(선택) 한국 휴장일 캘린더** | §0.3 기준: 법정 공휴일·대체 공휴일·12/31·5/1·임시 휴장일. 일봉/1시간봉 Cron에서 `isTradingDayKST()` 등으로 수집 생략. | `src/lib/korea-ohlc/market-hours.ts` 또는 전용 휴장일 데이터/API |

### 2.x 한국 시장 투표·마감·정산 타임라인 (구체)

#### 2.x.1 1일봉 마켓 (예: kospi_1d, kosdaq_1d)

- **투표 대상**: “오늘 하루 한국 지수(코스피/코스닥)의 **종가(15:30)**”.
- **투표 가능 시간**:  
  - **KST 09:00 ~ 15:29:45**  
  - 예: 09시에 Poll이 열리고, 15:29:45에 마지막 투표를 받고 15:29:45~15:30 사이에 투표 마감 처리.
- **Cron (1일봉 수집)**:  
  - KST **15:30 직후**(예: 15:30~15:40 사이) `/api/cron/kospi-ohlc-daily`, `/kosdaq-ohlc-daily` 호출.  
  - Yahoo 일봉에서 **당일 봉**의 OHLC를 가져와 `korea_ohlc (market=kospi_1d/kosdaq_1d)`에 upsert.
- **정산**:  
  - 1일봉 Cron이 성공적으로 `close`를 저장한 뒤, 별도 정산 Cron/서비스가 이를 읽어 Poll을 정산.  
  - 투표 마감은 15:29:45, 가격 기준은 15:30까지 반영된 일봉 종가.

#### 2.x.2 1시간봉 마켓 (예: kospi_1h, kosdaq_1h)

- **투표 대상**: 정규장 내 1시간 구간의 종가 (예: 09~10, 10~11, …, 14~15 KST).
- **투표 가능 시간 (각 1시간봉)**:  
  - 예: 09~10 봉이라면 **09:00 ~ 09:59:45**에 투표 가능, 10:00에 정각 마감.  
  - 일반화하면, `N~N+1시` 봉의 투표 가능 시간은 `N:00:00 ~ N:59:45`.
- **Cron (1시간봉 수집)**:  
  - 매 정각(10:00, 11:00, …, 15:00 KST)에 `/api/cron/kospi-ohlc-1h`, `/kosdaq-ohlc-1h` 호출.  
  - 라우트 내부에서:
    - `isTradingDayKST(오늘)`로 휴장일 필터링.  
    - `isTradingHourKST(현재시각)`으로 정규장 시간대(예: 10~15시 정각)에만 실제 Yahoo 호출.  
    - 예: 10:00 Cron → 09~10 KST 1시간봉 수집 → `korea_ohlc (market=kospi_1h, candle_start_at=해당 1시간 시작 UTC)` upsert.
- **정산**:  
  - 각 1시간봉 Cron이 해당 구간의 close를 저장한 뒤, 정산 Cron/서비스가 이를 읽어 Poll을 정산.  
  - 1시간봉 마켓의 “그날 마지막 투표 가능 시간”은 **14:00 ~ 14:59:45** (14~15 봉). 15~16 봉은 아예 수집/투표 대상에서 제외.

### Phase 3: 정산

| # | 과제 | 내용 | 산출물 |
|---|------|------|--------|
| 3.1 | **정산 서비스: korea_ohlc 분기** | settlePoll(또는 호출부)에서 market가 kospi/kosdaq이면 **korea_ohlc**에서 reference_close(open), settlement_close(close) 조회. 승/패/무효 판정 로직은 기존과 동일. | `src/lib/sentiment/settlement-service.ts` |
| 3.2 | **정산 Cron 연동** | 기존 “마감된 폴 정산” Cron이 kospi/kosdaq 폴도 처리하도록. korea_ohlc에 해당 candle_start_at 행이 있을 때만 정산 시도. | 기존 settlement cron 또는 통합 스케줄러 |
| 3.3 | **알림** | payout_history INSERT → 기존 payout_notification_trigger 그대로 사용 (시장 구분 없음). | 변경 없음 |

### Phase 4: 차트·부가

| # | 과제 | 내용 | 산출물 |
|---|------|------|--------|
| 4.1 | **차트 데이터 소스 선택** | (A) 기존처럼 Yahoo 프록시 `/api/sentiment/kospi-klines` 호출 + 주기 폴링으로 마지막 봉 갱신. (B) 또는 korea_ohlc에서 조회 API 제공 후 차트가 DB 기반으로 표시. 초기에는 (A) 유지해도 됨. | `KospiChart.tsx` (폴링 간격 추가 시) 또는 `/api/sentiment/korea-klines` |
| 4.2 | **당일 결과/전적** | kospi/kosdaq 시장의 당일 결과·전적 API가 korea_ohlc(또는 정산 결과) 기준으로 동작하도록. | `today-results`, `vote-history` 등 |

---

## 4. korea_ohlc 테이블 스키마

- **btc_ohlc와 동일**: `id`(uuid PK), `market`, `candle_start_at`(timestamptz), `open`/`close`/`high`/`low`(numeric 18,4), `created_at`/`updated_at`(timestamp without tz, Asia/Seoul), `candle_start_at_kst`(timestamp without tz), UNIQUE(market, candle_start_at).
- 인덱스: market, (market, candle_start_at desc), (candle_start_at desc), (candle_start_at_kst desc), (market, candle_start_at_kst desc).
- 트리거: `korea_ohlc_updated_at` BEFORE UPDATE → `korea_ohlc_set_updated_at()`.
- RLS 사용, 정책 "No direct client access" (Cron/API는 service_role).
- 정산 시 `open` = reference_close(시가), `close` = settlement_close(종가).

---

## 5. 시장별 캔들·마감 (안)

| 시장 | 타임존 | Cron 실행 | candle_start_at 정렬 |
|------|--------|-----------|----------------------|
| kospi_1d | Asia/Seoul | 매 영업일 15:30 직후 KST | 당일 KST 00:00(UTC 기준) 시작 → 09:00~15:30 장 전체를 하나의 일봉으로 간주 |
| kospi_1h | Asia/Seoul | **10:00~15:00 KST**, 1시간 간격 | 정규장 기준 1시간 봉 시작 시각(KST, 예: 09:00, 10:00, …, 14:00) |
| kosdaq_1d | 동일 | 매 영업일 15:30 직후 KST | 동일 |
| kosdaq_1h | 동일 | **10:00~15:00 KST**, 1시간 간격 | 동일 |

- Yahoo 일봉은 “전일 종가”가 다음 날 오전에 확정되므로, KST 09:00 수집으로 전일 봉 저장하는 방식이 자연스러움.

---

## 6. Cron URL 및 스케줄

- **인증 (공통)**  
  `Authorization: Bearer <CRON_SECRET>` 또는 헤더 `x-cron-secret: <CRON_SECRET>` 또는 쿼리 `?cron_secret=<CRON_SECRET>`

- **코스피 일봉 (1.3)**  
  - URL: `GET https://<배포 도메인>/api/cron/kospi-ohlc-daily`  
  - 스케줄: 타임존 **Asia/Seoul**, 매일 **09:00** (btc-ohlc-daily와 동일)  
  - **동작**: 주말/휴장일이면 Yahoo 호출 없이 `주말/휴장일, 수집 생략` 반환.

- **코스피 1시간봉 (1.4)**  
  - URL: `GET https://<배포 도메인>/api/cron/kospi-ohlc-1h`  
  - 스케줄: **타임존 Asia/Seoul, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00** (정각 1시간 간격).  
  - **동작**: 각 정각에 직전 1시간(09~10, 10~11, …, 14~15 KST)의 1시간봉을 Yahoo에서 가져와 `korea_ohlc (market=kospi_1h)`에 upsert. (휴장일은 라우트에서 `isTradingDayKST`로 필터링하여 수집 생략.)

- **코스닥 일봉 (1.5)**  
  - URL: `GET https://<배포 도메인>/api/cron/kosdaq-ohlc-daily`  
  - 스케줄: 타임존 Asia/Seoul, 매일 09:00  
  - **동작**: 주말/휴장일이면 수집 생략 (일봉과 동일).

- **코스닥 1시간봉 (1.5)**  
  - URL: `GET https://<배포 도메인>/api/cron/kosdaq-ohlc-1h`  
  - 스케줄: 타임존 Asia/Seoul, 10:00~15:00, 1시간 간격.  
  - **동작**: 코스피 1h와 동일. 휴장일/장 시간 외 구간이면 수집 생략.

---

## 7. 체크리스트 (진행 시 업데이트)

- [x] 1.1 korea_ohlc 마이그레이션
- [x] 1.2 Yahoo → korea_ohlc 수집 유틸
- [x] 1.3 kospi-ohlc-daily Cron
- [x] 1.4 kospi-ohlc-hourly Cron (초기 버전: 4h에서 1h 설계로 전환 예정)
- [x] 1.5 (선택) 코스닥 Cron — lib 지원 완료(kosdaq_1d/kosdaq_1h). Cron은 kospi clone·수정으로 별도 추가
- [ ] 2.1 한국 시장 상수
- [ ] 2.2 Poll API korea_ohlc 연동
- [ ] 2.3 Vote API 마감 검사
- [ ] 2.4 getCurrentCandleStartAt 한국 시장
- [ ] 3.1 정산 서비스 korea_ohlc 분기
- [ ] 3.2 정산 Cron 연동
- [ ] 4.1 차트 데이터 소스
- [ ] 4.2 당일 결과/전적

---

## 8. btc_ohlc vs korea_ohlc vs Yahoo API

| 컬럼 | btc_ohlc | korea_ohlc | Yahoo Chart API |
|------|----------|------------|-----------------|
| id | uuid PK | uuid PK | — |
| market | text | text | — (kospi_1d, kospi_1h 등) |
| candle_start_at | timestamptz | timestamptz | `timestamp[]` → Unix 초를 UTC로 변환 |
| open | numeric(18,4) | numeric(18,4) | `indicators.quote[0].open[i]` |
| close | numeric(18,4) | numeric(18,4) | `indicators.quote[0].close[i]` |
| high | numeric(18,4) NULL | numeric(18,4) NULL | `indicators.quote[0].high[i]` |
| low | numeric(18,4) NULL | numeric(18,4) NULL | `indicators.quote[0].low[i]` |
| created_at | timestamp (KST default) | 동일 | — |
| updated_at | timestamp (KST default) | 동일 + 트리거 | — |
| candle_start_at_kst | timestamp NULL | 동일 | — (candle_start_at에서 유도) |

- **동일 구조**: btc_ohlc와 동일 스키마·인덱스·트리거 패턴.
- **Yahoo와 합치**: `timestamp[i]`, `open[i]`, `high[i]`, `low[i]`, `close[i]` → 한 행 매핑.

---

## 9. 참고

- **btc_ohlc**: `docs/voting-spec.md`, `src/lib/btc-ohlc/repository.ts`, `src/lib/sentiment/settlement-service.ts`
- **Yahoo Chart API**: `src/app/api/sentiment/kospi-klines/route.ts` (^KS11). ^KQ11 동일 패턴.
- **기존 Cron 패턴**: `src/app/api/cron/btc-ohlc-daily/route.ts`, `btc-ohlc-4h/route.ts`

---

## 10. 2차 MVP: 한국투자증권 API 연동 (백테스트·자동매매까지)

> 1차 MVP에서는 **Yahoo Finance 기반 korea_ohlc + 투표/정산** 구조를 완성하고,  
> 2차 MVP에서 **한국투자증권(REST/WebSocket) API를 사용해 보다 정밀한 데이터·백테스트·자동매매까지 확장**하는 것을 목표로 한다.

### 10.1 목표

- 데이터 소스를 Yahoo에서 **한국투자증권 API**로 전환하거나,  
  필요 시 Yahoo를 fallback으로 두고 한국투자증권을 primary로 사용.
- **코스피/코스닥 지수 및 개별 종목**에 대해:
  - 더 촘촘한 틱/호가/체결 데이터
  - 장외/장전 거래 구간
  - 장기적인 백테스트용 OHLC 시계열
  를 확보.
- 투표/정산 파이프라인은 최대한 **korea_ohlc 스키마·로직 재사용**.

### 10.2 설계 방향

1. **데이터 공급자 추상화**
   - `src/lib/korea-ohlc/provider.ts` (예정)에 다음 인터페이스 정의:
     - `fetchKoreaKlinesFromYahoo(market, interval, ...)`
     - `fetchKoreaKlinesFromKis(market, interval, ...)`
   - Cron 및 투표 로직은 `fetchKoreaKlines(market, ...)`처럼 **단일 진입점**만 호출하고, 내부에서 현재 사용 중인 공급자(Yahoo/KIS)를 선택.

2. **한국투자증권 API PoC**
   - 제한된 범위(예: ^KS11에 대응하는 지수 상품, 혹은 KOSPI200 ETF 등)에서:
     - REST 호출 → OHLC 변환 → `korea_ohlc` upsert 흐름 검증.
   - 레이트 리밋, 인증 토큰 재발급, 에러 패턴을 로깅/모니터링.

3. **백테스트·자동매매 연계**
   - 백엔드에서 `korea_ohlc` + 한국투자증권 시세 API를 사용해:
     - 과거 특정 기간의 시나리오(“이 룰로 투표/포지션을 잡았으면 어떻게 됐나”)를 재현하는 백테스트 유틸.
     - 사용자가 정의한 전략에 따라 **실시간 주문/청산**까지 연결하는 자동매매 모듈(별도 서비스로 분리).
   - 투표 시스템과는 “데이터/전략 공유” 레벨에서만 연결하고, 주문/계좌 관리는 별도 보안/권한 체계로 분리.

4. **컴플라이언스/운영**
   - 한국투자증권 API **약관·상업적 이용 허용 범위·월간 호출량·데이터 보관 규칙**을 검토.
   - 필요한 경우, API 이용 목적(연구/개인/서비스)에 맞는 계약·승인 절차를 진행.

### 10.3 단계 요약

- **Phase A**: Yahoo 기반 korea_ohlc + 투표/정산 v1 완성 (현재 문서의 Phase 1~4).
- **Phase B**: 공급자 추상화(`provider.ts`) 도입, KIS용 fetch 함수 스텁 작성.
- **Phase C**: 한국투자증권 API PoC (지수 1d/1h → korea_ohlc upsert).
- **Phase D**: 안정화 후, Cron 공급자를 Yahoo → KIS로 전환 (필요 시 fallback 유지).
- **Phase E**: 별도 모듈로 백테스트/자동매매 기능 구현.
