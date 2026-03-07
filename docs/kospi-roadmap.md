# KOSPI 시장 추가 로드맵

> **주의**: 아직 구현하지 말 것. 로드맵 확정 후 단계별 진행.

---

## 1. 개요

### 1.1 목표

- KOSPI 1일봉, 4시간봉, 1시간봉, 15분봉, 5분봉 투표 시장 추가
- **차트**: TradingView 위젯 사용 (클라이언트)
- **지수 데이터**: KRX(한국거래소) → DB 저장
- **운영**: BTC와 동일한 시스템 (cron 수집 → btc_ohlc 저장 → 정산)

### 1.2 BTC 시스템 참고

| 구분 | BTC | KOSPI (목표) |
|------|-----|--------------|
| 차트 | Binance API + Lightweight Charts | **TradingView** 위젯 |
| OHLC 수집 | Binance API | **KRX API** |
| 저장 | btc_ohlc (market 컬럼) | btc_ohlc (market=kospi_1d 등) |
| Cron | btc-ohlc-daily, 4h, 1h, 15m, 5m | kospi-ohlc-* 동일 구조 |
| 정산 | settlement-service | 동일 (market 구분) |

---

## 2. 데이터 소스

### 2.1 KRX API 조사

- **KRX Data Marketplace**: https://openapi.krx.co.kr
  - KOSPI 시리즈 일별시세정보 (2010년~)
  - API 인증키 신청 필요
- **코스콤 오픈API**: https://koscom.gitbook.io/open-api
  - 시/고/저/종: 10초, 1분, 10분 단위
  - 5분, 15분, 1시간, 4시간: **리샘플링** 또는 별도 소스 필요

### 2.2 확정 필요 사항

- [ ] KRX/코스콤 API 가입 및 인증키 발급
- [ ] 5분/15분/1시간/4시간봉 데이터 제공 여부 확인
- [ ] 미제공 시: 1분봉 리샘플링 또는 대체 소스 (예: Yahoo Finance, Investing.com 등) 검토

---

## 3. DB·스키마

### 3.1 btc_ohlc 테이블

- **현재**: `(market, candle_start_at)` UNIQUE, market에 btc_1d, btc_4h 등
- **KOSPI**: market에 `kospi_1d`, `kospi_4h`, `kospi_1h`, `kospi_15m`, `kospi_5m` 추가
- **변경**: 테이블명·스키마 변경 없음. market 값만 확장.

### 3.2 sentiment_polls

- **현재**: market에 btc_*, ndq, sp500, kospi, kosdaq
- **KOSPI**: kospi_1d, kospi_4h 등 추가 (이미 kospi는 sentiment_markets에 있음 → 세분화 필요)

### 3.3 candle_start_at 정렬

- **KOSPI 거래 시간**: KST 09:00~15:30 (정규장)
- **1일봉**: KST 09:00~15:30 = 당일 종가. candle_start_at = 당일 00:00 KST → UTC -9h
- **4h/1h/15m/5m**: 거래 시간 내 슬롯. BTC처럼 UTC 또는 KST 기준 통일 필요.

---

## 4. 구현 단계 (로드맵)

### Phase 0: 사전 조사 (구현 전)

1. **KRX API**
   - [ ] API 문서·엔드포인트 확인
   - [ ] 인증키 발급 절차
   - [ ] KOSPI 지수 OHLC 제공 형식 (일봉/분봉)
2. **TradingView**
   - [ ] KOSPI 차트 심볼 (예: KRX:KOSPI)
   - [ ] 위젯/임베드 방식 (TradingView Charting Library vs iframe)
   - [ ] 라이선스·이용약관 확인

### Phase 1: 데이터 파이프라인

1. **KRX 수집 모듈**
   - [ ] `src/lib/krx/` 또는 `src/lib/kospi/` 생성
   - [ ] KRX API 클라이언트 (인증, 요청/응답 파싱)
   - [ ] fetchKospiKlines (interval별) 함수
   - [ ] BtcOhlcRow와 호환되는 형식으로 변환
2. **candle-utils 확장**
   - [ ] getCurrentCandleStartAt(kospi_1d), getCurrentCandleStartAt(kospi_4h) 등
   - [ ] KOSPI 거래 시간·마감 시각 반영
3. **Repository**
   - [ ] upsertBtcOhlcBatch에 kospi_* market 지원 (이미 market 컬럼 있음)
   - [ ] getOhlcByMarketAndCandleStart(kospi_1d, ...) 동작 확인

### Phase 2: Cron

1. **Cron Route**
   - [ ] `kospi-ohlc-daily` (매일 15:35 KST?)
   - [ ] `kospi-ohlc-4h`, `kospi-ohlc-1h`, `kospi-ohlc-15m`, `kospi-ohlc-5m`
2. **실행 시각**
   - [ ] 1일봉: 장 마감(15:30) 직후
   - [ ] 4h/1h/15m/5m: BTC와 유사 주기 (거래 시간 고려)
3. **cron-job.org**
   - [ ] 각 cron URL 등록

### Phase 3: Poll·정산

1. **sentiment_markets**
   - [ ] kospi_1d, kospi_4h, kospi_1h, kospi_15m, kospi_5m 추가
   - [ ] MARKET_CLOSE_KST, MARKET_LABEL 등
2. **poll-server**
   - [ ] getOrCreateTodayPollByMarket(kospi_1d) 등
   - [ ] candle_start_at 생성 로직 (KOSPI 거래 시간)
3. **settlement-service**
   - [ ] btc_ohlc에서 kospi_* 조회 (이미 market 파라미터 있음)
   - [ ] 정산 로직 동일 (reference_close vs settlement_close)
4. **Vote API**
   - [ ] kospi 시장 마감 검사 (getOhlcByMarketAndCandleStart)

### Phase 4: UI

1. **차트**
   - [ ] TradingView 위젯 연동 (predict/[market] 페이지)
   - [ ] market=kospi_* 일 때 BtcChart 대신 TradingView 렌더
   - [ ] 심볼: KRX:KOSPI
2. **투표 상세 페이지**
   - [ ] 목표가(시가): btc_ohlc에서 kospi 이전 봉 종가
   - [ ] 현재가: KRX 실시간 또는 DB 최신 (선택)
3. **홈·필터**
   - [ ] KOSPI 필터에 kospi_1d~5m 노출
   - [ ] MarketVoteCardCompact, MarketIcon (이미 KOSPI 아이콘 있음)

### Phase 5: 백필·모니터링

1. **백필**
   - [ ] kospi-ohlc-backfill API (과거 데이터)
   - [ ] 관리자 백필 후 정산 (기존 backfill-and-settle 확장)
2. **모니터링**
   - [ ] cron-health에 kospi cron 상태 추가

---

## 5. KOSPI 거래 시간 고려사항

| 항목 | 값 |
|------|-----|
| 정규장 | KST 09:00 ~ 15:30 |
| 1일봉 마감 | 15:30 KST |
| 4h/1h/15m/5m | 거래 시간 내 슬롯만 유효 (장 외 데이터 없음) |

- **1일봉**: candle_start_at = 당일 00:00 KST, 마감 15:30 KST
- **분봉**: 09:00~15:30 구간만. 15:30 이후 다음날 09:00까지 갭.

---

## 6. 의존성·리스크

| 리스크 | 대응 |
|--------|------|
| KRX API 미제공(분봉) | 1분봉 리샘플링 또는 Yahoo/Investing 등 대체 |
| TradingView 라이선스 | 무료 임베드 범위 확인, 필요 시 유료 |
| 장 외 시간 투표 | 거래 시간 외에는 투표 불가 또는 별도 규칙 |

---

## 7. 참고

- `docs/voting-spec.md`: 투표·정산 명세
- `src/lib/btc-ohlc/`: 캔들 유틸, repository
- `src/app/api/cron/btc-ohlc-*`: BTC cron 구조
- `src/lib/sentiment/settlement-service.ts`: 정산 로직
