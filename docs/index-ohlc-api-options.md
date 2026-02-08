# 시장별 OHLC(시가·종가) API 조사

KOSPI, KOSDAQ, Nasdaq-100, S&P 500 지수 시가·종가 수집용 API 옵션 정리.

## 요구사항

- KST 00:00 기준 시가, 다음날 KST 00:00 기준 종가 (일봉)
- 소수점 둘째자리까지 저장 (`Math.round(x * 100) / 100`)
- cron에서 매일 수집, sentiment_polls에 price_open, price_close 반영

---

## 1. 비트코인 (BTC)

**현재 구현**: Binance 공개 API  
- `GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h`  
- 소수점 둘째자리: `Math.round(x * 100) / 100` ✓

---

## 2. 미국 지수: S&P 500, Nasdaq-100

### FMP (Financial Modeling Prep) – 프로젝트 이미 사용 중

- **Historical Index Full Chart API**  
  `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=^GSPC&apikey=...`

- **지수 심볼** (일반적 표기):
  - S&P 500: `^GSPC`
  - Nasdaq Composite: `^IXIC`
  - Nasdaq-100: `^NDX` (FMP 지원 여부 문서 확인 필요)

- **응답**: open, high, low, close 등 일봉 데이터
- **소수점**: 지수는 보통 소수 둘째자리까지 (예: 5234.56)
- **장점**: 프로젝트에 FMP_API_KEY 있음, 미국 지수 지원
- **단점**: KOSPI/KOSDAQ 미지원 가능성 높음

---

## 3. 한국 지수: KOSPI, KOSDAQ

### 3-1. FMP

- FMP는 한국 거래소(KRX) 지수 직접 지원이 제한적일 수 있음.
- 문서에서 `^KS11`(KOSPI), `^KQ11`(KOSDAQ) 등 한국 지수 심볼 지원 여부 확인 필요.

### 3-2. Yahoo Finance (yfinance)

- **심볼**: KOSPI `^KS11`, KOSDAQ `^KQ11`
- **제공**: 일봉 OHLC
- **방식**: Python `yfinance` 라이브러리 또는 비공식 REST API
- **단점**: 공식 REST API 없음, 스크래핑/비공식 엔드포인트 의존

### 3-3. 한국거래소(KRX) 정보데이터시스템

- **URL**: https://data.krx.co.kr
- **제공**: KOSPI, KOSDAQ 공식 지수 데이터
- **장점**: 공식 출처, 정확도 높음
- **단점**: API 사용 조건·가격 확인 필요, 연동 방식 문서 검토 필요

### 3-4. FinanceDataReader (Python)

- **패키지**: `pip install finance-datareader`
- **심볼**: `'KS11'` (KOSPI), `'KQ11'` (KOSDAQ)
- **제공**: Pandas DataFrame, 일봉 OHLC
- **장점**: 한국 지수 전용, 사용 간단
- **단점**: Python 전용, Node.js에서 호출 시 Python 스크립트 또는 별도 서비스 필요

---

## 4. 권장 구조

| 시장    | API/출처        | 비고                         |
|---------|-----------------|------------------------------|
| btc     | Binance (현재)  | 구현 완료                    |
| sp500   | FMP `^GSPC`     | FMP Historical Index API 사용 |
| ndq     | FMP `^NDX`      | Nasdaq-100, FMP 지원 확인 필요 |
| kospi   | FMP 또는 KRX    | FMP 한글 심볼 미지원 시 KRX 검토 |
| kosdaq  | FMP 또는 KRX    | 위와 동일                    |

---

## 5. 구현 순서 제안

1. **FMP Historical Index API로 sp500, ndq 연동**  
   - `^GSPC`, `^NDX` 등으로 일봉 조회  
   - 응답 open/close를 `Math.round(x * 100) / 100`로 반올림 후 저장  

2. **한국 지수 (kospi, kosdaq)**  
   - FMP에서 `^KS11`, `^KQ11` 지원 여부 확인  
   - 미지원 시: KRX API 또는 FinanceDataReader 기반 Python 크론 검토  

3. **크론 확장**  
   - `btc-ohlc-daily` → `ohlc-daily` 등으로 통합  
   - market별로 해당 API 호출 후 `sentiment_polls`에 `price_open`, `price_close` 업데이트  

---

## 6. 소수점 둘째자리 처리 (확인됨)

| 시장      | 수집 소스      | 저장 시 반올림           |
|-----------|----------------|---------------------------|
| btc       | Binance        | `Math.round(x * 100) / 100` ✓ |
| sp500     | FMP            | 동일 적용 예정            |
| ndq       | FMP            | 동일 적용 예정            |
| kospi     | FMP/KRX 등     | 동일 적용 예정            |
| kosdaq    | FMP/KRX 등     | 동일 적용 예정            |

지수 값은 대부분 소수 둘째자리 이하가 의미 있으므로, 전 시장 공통으로 `Math.round(x * 100) / 100` 사용 권장.
