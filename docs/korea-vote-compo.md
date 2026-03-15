# 한국 주식 투표 컴포넌트 – 추가·재사용 가이드

> 한국에 있는 주식(지수·개별 종목)을 투표 리스트에 추가하거나, **다른 지역 주식**(미국·중국·일본 등)에서 기존 한국 시장 투표 구조를 그대로 재사용하기 위한 체크리스트입니다.

---

## 1. 참고 문서

- **한국 시장 투표 구조 전체 명세**: [`docs/korea-ohlc-roadmap.md`](./korea-ohlc-roadmap.md)  
  - 데이터 소스(Yahoo), DB(`korea_ohlc`), Cron, 투표·마감·정산·당일 결과·전적까지의 흐름이 정리되어 있습니다.
- 한국 주식 추가 시 **반드시** 위 로드맵을 참고하여, 기존에 구현된 “한국 시장 투표 구조”와 동일한 방식으로 확장합니다.

---

## 2. 기존 한국 시장 투표 구조 요약

현재 다음이 이미 구현되어 있습니다.

| 구분 | 내용 |
|------|------|
| **DB** | `korea_ohlc` (market, candle_start_at, open, high, low, close 등) |
| **데이터 소스** | Yahoo Finance (^KS11, ^KQ11) → `src/lib/korea-ohlc/yahoo-klines.ts` |
| **시장 시간/휴장** | `src/lib/korea-ohlc/market-hours.ts`, `src/data/korea-market-holidays.json` |
| **Cron** | kospi-ohlc-daily, kospi-ohlc-1h, kosdaq-ohlc-daily, kosdaq-ohlc-1h (수집 후 정산 연동) |
| **Poll API** | `korea_ohlc` 기준 목표가(시가)·종가, candle_start_at 폴 조회 |
| **Vote API** | 마감 검사 시 `korea_ohlc` 해당 봉 존재 여부로 투표 차단 |
| **정산** | `settlement-service`에서 직전 봉·현재 봉 `settlement_close` 기준 |
| **당일 결과/전적** | today-results, vote-history에서 `korea_ohlc` 조회 |
| **차트** | `/api/sentiment/korea-klines`, KospiChart 등 `korea_ohlc` 기반 |
| **UI** | `sentiment-markets.ts`의 시장 목록·라벨·마감 시각, 홈/상세 페이지 공통 컴포넌트 |

위 구조를 **컴포넌트처럼** 유지하면서, 새 시장을 “한국 시장과 동일한 파이프라인”으로 붙이는 것이 목표입니다.

### 2.1 한국 주식 시장 가격 표시 (목표가·현재가)

| 구분 | 형식 | 예시 |
|------|------|------|
| **한국 지수** (코스피, 코스닥) | **포인트** (통화 기호 없음) | 2,750.00 |
| **한국 개별 주식** (삼성전자 등) | **원화(KRW)** | ₩75,000 |
| 코인·기타 | 달러($) | $97,500.00 |

- 적용 위치: 투표 상세 페이지의 "목표가 (시가)", "현재가" 블록.
- 구현: `src/lib/utils/price-format.ts`의 `getKoreanPriceDisplayKind`, `formatMarketPrice`. 새 한국 개별 주식 추가 시 `KOREA_STOCK_PREFIXES`에 접두사만 추가하면 KRW로 표시됨.

### 2.2 투표 마감·LIVE 판별 (거래일 필터)

한국 시장(kospi, kosdaq, samsung, skhynix 등) 투표지는 **거래일이 아닐 때 항상 마감 상태**로 표시됩니다.

| 항목 | 내용 |
|------|------|
| **적용 대상** | `isKoreaMarket`인 모든 시장 (kospi_, kosdaq_, samsung_, skhynix_ 접두사) |
| **거래일 판별** | `src/lib/korea-ohlc/market-hours.ts`의 **`isTradingDayKST(date)`** (평일 + 휴장일 제외) |
| **적용 위치** | `src/lib/utils/sentiment-vote.ts`의 **`getMillisUntilClose`** → `isVotingOpenKST`에서 사용 |
| **동작** | `!isTradingDayKST(new Date())`이면 즉시 `0` 반환 → LIVE 아님(마감된 상태 유지) |

- 휴장일 목록: `src/data/korea-market-holidays.json` 및 `market-hours.ts` 내 연도별 휴장 세트. 새 한국 주식 추가 시 `sentiment-vote.ts`의 `isKoreaMarket`에 해당 접두사만 포함하면 자동 적용됨.

---

## 3. 내가 따로 해야 할 것들

### 3.1 한국 주식(지수·개별)을 추가할 때

한국에 있는 **새 지수 또는 개별 종목**을 투표 리스트에 넣고, 기존 한국 시장 구조를 그대로 쓰려면 아래를 순서대로 진행합니다.

| # | 할 일 | 파일/위치 | 비고 |
|---|--------|-----------|------|
| 1 | **시장 코드·라벨·마감 시각 등록** | `src/lib/constants/sentiment-markets.ts` | `SENTIMENT_MARKETS`, `MARKET_CLOSE_KST`, `MARKET_LABEL`, `DISPLAY_MARKETS`(또는 홈 노출용 배열), `MARKET_SECTIONS` 등에 새 market 추가 (예: `kospi200_1d`, `samsung_1d`). **한국 주식**이면 `KOREA_STOCK_PREFIXES`에 접두사(예: `hyundai_`) 추가 → 마감 후 "다음 투표" 대신 **"다음"**만 표시되도록 함 |
| 2 | **Yahoo 심볼 매핑** | `src/lib/korea-ohlc/yahoo-klines.ts` | `fetchKorea1dKlines` / `fetchKorea1hKlines` 등에서 `market` → Yahoo symbol 매핑 추가 (예: kospi200 → ^KRX200, 개별주식 → 005930.KS) |
| 3 | **캔들·폴 날짜 유틸** | `src/lib/btc-ohlc/candle-utils.ts` | `CANDLE_PERIOD_MS`, `getCurrentCandleStartAt`, `getCandlesForPollDate`, `getPreviousCandleStartAt` 등에 새 market 분기 추가 (1d/1h 규칙은 기존 kospi/kosdaq와 동일하면 재사용) |
| 4 | **한국 시장 목록 상수** | Poll/Vote/Settlement/Results 등 | 각 파일의 `KOREA_MARKETS`(또는 동일 역할 상수) 배열에 새 market 추가 → `korea_ohlc` 사용 대상으로 인식되게 함 |
| 5 | **Cron 라우트 추가** | `src/app/api/cron/` | 기존 `kospi-ohlc-daily`, `kospi-ohlc-1h` 등을 복제한 뒤 **market 상수만** 새 시장으로 변경 (수집 → `korea_ohlc` upsert → `settlePoll` 호출 구조 유지) |
| 6 | **정산·당일 결과·전적** | `settlement-service`, `today-results`, `vote-history` | 이미 “한국 시장 = korea_ohlc”로 분기되어 있으므로, **KOREA_MARKETS에만 새 market를 넣으면** 자동으로 동작 (별도 테이블/로직 추가 불필요) |
| 7 | **가격 표시 형식** | `src/lib/utils/price-format.ts` | **한국 지수**(코스피·코스닥): 목표가/현재가 = **포인트**. **한국 개별 주식**: **원화(KRW, ₩)**. 새 개별 주식 추가 시 `KOREA_STOCK_PREFIXES`에 접두사 추가 |
| 8 | **아이콘/필터(선택)** | `MarketIcon.tsx`, `VotingSection.tsx` | 새 시장용 아이콘 URL, 홈 필터 탭(예: “한국 주식”)에 해당 market 포함 여부 확인 |
| 9 | **관리자 백필(선택)** | `KoreaOhlcBackfillTab`, `/api/admin/korea-ohlc-backfill` | 백필 UI/API에서 새 market를 선택 가능하게 하려면 옵션 추가 |

요약: **시장 상수·Yahoo 심볼·캔들 유틸·Cron**만 새 시장 기준으로 추가/복제하고, 나머지(Poll, Vote, 정산, 당일 결과, 전적)는 **기존 “한국 시장” 분기를 타도록** `KOREA_MARKETS` 등에만 넣으면 됩니다.

---

### 3.2 다른 지역 주식(미국·중국·일본 등)에서 “한국 구조”를 재사용할 때

한국 시장과 **동일한 컴포넌트 구조**를 쓰되, 데이터만 **다른 테이블·다른 Cron·다른 시장 시간**으로 두려면 다음을 진행합니다.

| # | 할 일 | 설명 |
|---|--------|------|
| 1 | **지역용 OHLC 테이블·로드맵** | 예: 미국 → `usa_ohlc` + `docs/usa-ohlc-roadmap.md`. 한국과 동일한 스키마·흐름(수집 → 투표 → 정산 → 결과/전적)을 참고하여 설계 |
| 2 | **지역용 수집·시장 시간** | 해당 지역 거래 시간·휴장일(예: `usa-market-holidays.json`, `usa-ohlc/market-hours.ts`) 정의. Cron은 해당 지역 장 마감 시점에 수집·정산 호출 |
| 3 | **Poll / Vote / Settlement / Results / History 분기** | 기존 “한국 시장” 분기(`KOREA_MARKETS`, `getKoreaOhlcByMarketAndCandleStart` 등)를 참고해, **해당 지역 시장 목록** + **해당 테이블 조회 함수**를 같은 패턴으로 추가 (예: `USA_MARKETS`, `getUsaOhlcByMarketAndCandleStart`) |
| 4 | **캔들 유틸** | 해당 지역 1d/1h(또는 4h)의 `candle_start_at` 규칙을 `candle-utils.ts`(또는 지역 전용 유틸)에 추가 |
| 5 | **시장 상수** | `sentiment-markets.ts`에 해당 시장 코드·마감 시각·라벨 등록 (이미 ndq, sp500 등이 있으면, 여기서는 “OHLC·정산 연동”만 새로 연결) |
| 6 | **Cron·백필** | 해당 지역용 Cron 라우트·관리자 백필 옵션 추가 (한국 Cron을 복제한 뒤 테이블·시장·휴장일만 교체) |

이렇게 하면 **UI·투표 플로우·정산 로직**은 기존 한국 시장과 동일한 “컴포넌트”를 쓰고, **데이터 소스·테이블·Cron·시장 시간**만 지역별로 갈라지게 할 수 있습니다.

---

## 4. 다른 지역별 구체 가이드 (미국·일본·중국)

아래는 **미국·일본·중국** 주식 시장에 한국 투표 구조를 재사용할 때, **지역별로 만들어 두어야 할 것**과 **기존 코드에 넣을 분기**를 구체적으로 정리한 것입니다. 각 지역마다 `korea_ohlc` + 한국 Cron/API 분기와 **같은 패턴**으로 테이블·lib·Cron·API 분기를 추가하면 됩니다.

### 4.1 미국 (USA)

| 항목 | 내용 |
|------|------|
| **참고 로드맵** | [`docs/usa-ohlc-roadmap.md`](./usa-ohlc-roadmap.md) |
| **OHLC 테이블** | `usa_ohlc` (스키마는 `korea_ohlc`와 동일: market, candle_start_at, open, high, low, close 등) |
| **Yahoo 심볼** | ^GSPC(S&P500), ^NDX(나스닥100), ^DJI(다우존스). 시장 코드 예: `sp500_1d`, `sp500_4h`, `ndq_1d`, `ndq_4h`, `dow_jones_1d`, `dow_jones_4h` |
| **거래 시간** | 동부(ET) 09:30~16:00. KST로 표시 시 ET+14(서머타임 시 ET+13). 마감 시각은 `sentiment-markets.ts`의 `MARKET_CLOSE_KST`에 이미 ndq/sp500/dow_jones 등록 가능 |
| **휴장일** | `src/data/usa-market-holidays.json` (연도별 `["YYYY-MM-DD", ...]`). NYSE 공식 휴장일(원더스데이, MLK데이, 독립기념일, 추수감사절, 크리스마스 등) |
| **생성할 것** | `src/lib/usa-ohlc/` (repository.ts, yahoo-klines.ts, candle-utils.ts, market-hours.ts), `src/app/api/cron/sp500-ohlc-daily/` 등, `src/app/api/sentiment/usa-klines/`, `src/app/api/sentiment/usa-realtime/`(선택), `src/app/api/admin/usa-ohlc-backfill/` |
| **API 분기 추가** | `poll/route.ts`, `vote/route.ts`, `settlement-service.ts`, `today-results/route.ts`, `vote-history/route.ts`에 `USA_MARKETS` 배열 + `getUsaOhlcByMarketAndCandleStart`(또는 usa_ohlc 직접 조회) 분기 추가. `getCandlesForPollDate`, `getPreviousCandleStartAt`, `CANDLE_PERIOD_MS`에 ndq/sp500/dow_jones 1d·4h 반영 |
| **Cron 스케줄** | 일봉: ET 16:00 직후(또는 KST 기준 새벽 6시대) 수집 Cron 실행 → `usa_ohlc` upsert → `settlePoll` 호출. 4시간봉은 로드맵에 따라 ET 기준 4시간 경계에 수집 |

### 4.2 일본 (Japan)

| 항목 | 내용 |
|------|------|
| **참고 로드맵** | (신규 작성 권장) `docs/japan-ohlc-roadmap.md` – 한국/미국 로드맵과 동일한 목차(거래·휴장 기준, Yahoo 심볼, 단계별 과제, Cron URL, 체크리스트) |
| **OHLC 테이블** | `japan_ohlc` 또는 통합 시 `region_ohlc` + region='japan'. 스키마는 `korea_ohlc`와 동일 |
| **Yahoo 심볼** | ^N225(니케이225). 시장 코드 예: `nikkei_1d`, `nikkei_4h` (이미 `sentiment-markets.ts`에 nikkei 있음) |
| **거래 시간** | JST 09:00~15:00(정규장). KST = JST 동일. 마감 15:00 JST = 15:00 KST → `MARKET_CLOSE_KST['nikkei_1d']` 등 |
| **휴장일** | `src/data/japan-market-holidays.json`. 일본 증시 휴장일(원단, 성인식, 건국기념일, 천황탄생일, 신년 연휴, 해산일 등) |
| **생성할 것** | `src/lib/japan-ohlc/` (repository.ts, yahoo-klines.ts, candle-utils.ts, market-hours.ts), `src/app/api/cron/nikkei-ohlc-daily/`, `nikkei-ohlc-4h/`(또는 1h), `src/app/api/sentiment/japan-klines/`, `src/app/api/admin/japan-ohlc-backfill/` |
| **API 분기 추가** | `poll/route.ts`, `vote/route.ts`, `settlement-service.ts`, `today-results/route.ts`, `vote-history/route.ts`에 `JAPAN_MARKETS` + `getJapanOhlcByMarketAndCandleStart`(또는 japan_ohlc 조회) 분기. 캔들 유틸에 nikkei_1d, nikkei_4h 규칙 추가 |
| **Cron 스케줄** | 일봉: JST 15:00 직후 수집(한국 15:00와 동일). 4h 사용 시 JST 기준 4시간 경계(09, 13 등)에 수집 후 정산 |

### 4.3 중국 (China)

| 항목 | 내용 |
|------|------|
| **참고 로드맵** | (신규 작성 권장) `docs/china-ohlc-roadmap.md` – 한국/미국과 동일한 목차로 상해/심천 거래·휴장 기준, Yahoo 심볼, 단계 정리 |
| **OHLC 테이블** | `china_ohlc` 또는 통합 시 `region_ohlc` + region='china'. 스키마는 `korea_ohlc`와 동일 |
| **Yahoo 심볼** | 상해종합: ^SSEC 또는 000001.SS. 시장 코드 예: `shanghai_1d`, `shanghai_4h` (이미 sentiment-markets에 shanghai 있음). 심천 확장 시 ^SZSE 등 |
| **거래 시간** | CST(중국 표준시) 09:30~15:00(상해·심천). KST = CST+1. 마감 15:00 CST = 16:00 KST → `MARKET_CLOSE_KST['shanghai_1d']` 등 |
| **휴장일** | `src/data/china-market-holidays.json`. 중국 공휴일(춘절, 청명절, 노동절, 단오, 중추절, 국경일 등). 상해/심천 거래소 공지 참고 |
| **생성할 것** | `src/lib/china-ohlc/` (repository.ts, yahoo-klines.ts, candle-utils.ts, market-hours.ts), `src/app/api/cron/shanghai-ohlc-daily/`, `shanghai-ohlc-4h/`(또는 1h), `src/app/api/sentiment/china-klines/`, `src/app/api/admin/china-ohlc-backfill/` |
| **API 분기 추가** | `poll/route.ts`, `vote/route.ts`, `settlement-service.ts`, `today-results/route.ts`, `vote-history/route.ts`에 `CHINA_MARKETS` + `getChinaOhlcByMarketAndCandleStart`(또는 china_ohlc 조회) 분기. 캔들 유틸에 shanghai_1d, shanghai_4h 규칙 추가 |
| **Cron 스케줄** | 일봉: CST 15:00 직후 = KST 16:00 직후 수집. 4h 사용 시 CST 기준 4시간 경계에 수집 후 정산 |

### 4.4 공통 체크리스트 (지역 추가 시 한 번씩)

아래는 **미국·일본·중국 중 한 지역**을 붙일 때, 공통으로 확인할 작업 목록입니다.

| # | 작업 | 설명 |
|---|------|------|
| 1 | **마이그레이션** | `xxx_ohlc` 테이블 생성 (korea_ohlc와 동일 컬럼). UNIQUE(market, candle_start_at) |
| 2 | **지역 lib** | `src/lib/{region}-ohlc/repository.ts`(upsert, getByMarketAndCandleStart), `yahoo-klines.ts`(시장→Yahoo 심볼, 1d/1h 또는 4h 수집), `market-hours.ts`(isTradingDay, isHoliday), 필요 시 `candle-utils.ts` |
| 3 | **휴장일 JSON** | `src/data/{region}-market-holidays.json` 연도별 배열. Cron에서 수집 전에 isTradingDay 체크 |
| 4 | **candle-utils** | `CANDLE_PERIOD_MS`, `getCurrentCandleStartAt`, `getCandlesForPollDate`, `getPreviousCandleStartAt`에 해당 지역 market(1d/4h 또는 1h) 추가 |
| 5 | **sentiment-markets** | 해당 시장이 이미 있으면 마감 시각만 점검. 없으면 SENTIMENT_MARKETS, MARKET_CLOSE_KST, MARKET_LABEL, DISPLAY_MARKETS, MARKET_SECTIONS 등에 추가 |
| 6 | **Poll API** | `XXX_MARKETS` 배열 + 해당 테이블에서 직전 봉·현재 봉 조회해 price_open, price_close 설정 (한국 분기 복사 후 테이블/함수만 교체) |
| 7 | **Vote API** | `XXX_MARKETS` + 해당 테이블에 candle_start_at 존재 시 투표 거부 (한국 분기와 동일 패턴) |
| 8 | **Settlement** | `getSettlementPricesFromOhlc`에 해당 지역 분기: 직전 봉 settlement_close = reference_close, 현재 봉 settlement_close = settlement_close |
| 9 | **today-results** | 당일 candle_start_at 목록 조회 + 해당 지역 OHLC 테이블에서 직전 봉 close vs 현재 봉 close로 outcome 계산 (한국 분기 복사) |
| 10 | **vote-history** | 해당 지역 market이면 해당 테이블에서 직전/현재 봉 조회해 price_open, price_close, change_pct 설정 (한국 분기 복사) |
| 11 | **Cron** | 수집 Cron 라우트(일봉/4h 또는 1h) 추가. 수집 → upsert → settlePoll 호출. 스케줄은 해당 지역 장 마감 시각(KST로 환산) |
| 12 | **차트·실시간(선택)** | `/api/sentiment/{region}-klines`, 상세 페이지에서 해당 지역일 때 해당 API 사용. 실시간 가격 필요 시 `{region}-realtime` |
| 13 | **관리자 백필** | `/api/admin/{region}-ohlc-backfill`, AdminDashboard에 해당 지역 백필 탭 추가 |

---

## 5. 터치포인트 정리 (한국 시장 기준)

한국 시장을 기준으로, “새 시장을 붙일 때 수정하는 곳”을 파일 단위로 정리했습니다. **다른 지역(미국·일본·중국)**은 §4 지역별 가이드와 §4.4 공통 체크리스트에 따라 동일한 역할의 파일/상수를 해당 지역용으로 추가하면 됩니다.

| 역할 | 파일/위치 |
|------|-----------|
| 시장 목록·라벨·마감 시각 | `src/lib/constants/sentiment-markets.ts` |
| Yahoo 심볼·1d/1h 수집 | `src/lib/korea-ohlc/yahoo-klines.ts` |
| 시장 시간·휴장일 | `src/lib/korea-ohlc/market-hours.ts`, `src/data/korea-market-holidays.json` |
| 캔들 시각·주기 | `src/lib/btc-ohlc/candle-utils.ts`, `src/lib/korea-ohlc/candle-utils.ts` (사용 시) |
| OHLC 조회 | `src/lib/korea-ohlc/repository.ts` |
| Poll API | `src/app/api/sentiment/poll/route.ts` (KOREA_MARKETS, getKoreaOhlcByMarketAndCandleStart) |
| Vote API | `src/app/api/sentiment/vote/route.ts` (KOREA_MARKETS, getKoreaOhlcByMarketAndCandleStart) |
| 정산 | `src/lib/sentiment/settlement-service.ts` (한국 시장 분기) |
| 당일 결과 | `src/app/api/sentiment/polls/today-results/route.ts` (KOREA_MARKETS) |
| 전적 | `src/app/api/profile/vote-history/route.ts` (KOREA_MARKETS, getKoreaOhlcByMarketAndCandleStart) |
| 차트 API | `src/app/api/sentiment/korea-klines/route.ts` |
| 실시간 가격(선택) | `src/app/api/sentiment/korea-realtime/route.ts` |
| Cron | `src/app/api/cron/kospi-ohlc-daily`, `kospi-ohlc-1h`, `kosdaq-ohlc-daily`, `kosdaq-ohlc-1h` |
| 관리자 백필 | `src/app/api/admin/korea-ohlc-backfill/route.ts`, `KoreaOhlcBackfillTab.tsx` |
| 아이콘·필터 | `src/components/market/MarketIcon.tsx`, `src/components/home/VotingSection.tsx` |
| 상세 페이지 차트·당일 결과 | `src/app/predict/[market]/page.tsx`, `KospiChart.tsx`, `TradingViewChart.tsx` |

---

## 6. 요약

- **한국 주식 추가**: [`korea-ohlc-roadmap.md`](./korea-ohlc-roadmap.md)를 참고하고, §3.1 체크리스트대로 **시장 상수·Yahoo 심볼·캔들 유틸·KOREA_MARKETS·Cron**만 새 시장 기준으로 추가·확장하면, 기존 투표·정산·당일 결과·전적 구조를 그대로 사용할 수 있습니다.
- **다른 지역 주식(미국·일본·중국) 재사용**: §3.2와 **§4 지역별 구체 가이드**를 따른다. 각 지역마다 `xxx_ohlc` 테이블·`src/lib/{region}-ohlc/`·휴장일 JSON·Cron을 두고, Poll/Vote/정산/당일 결과/전적에 **한국 분기와 동일한 패턴**으로 `XXX_MARKETS` + 해당 테이블 조회 분기만 추가하면, 기존 한국 시장 투표 컴포넌트를 그대로 재사용할 수 있습니다. §4.4 공통 체크리스트로 누락 없이 진행할 수 있습니다.
