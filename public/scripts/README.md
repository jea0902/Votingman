# 버핏원픽 데이터 수집 스크립트

FMP (Financial Modeling Prep) API를 사용하여 S&P 500, NASDAQ 100 종목의 재무 데이터를 수집하는 Python 스크립트입니다.

## 사전 요구사항

### 1. Python 환경 설정

```bash
# Python 3.9 이상 필요
python --version

# 가상환경 생성 (권장)
python -m venv venv

# 가상환경 활성화 (Windows)
.\venv\Scripts\activate

# 가상환경 활성화 (macOS/Linux)
source venv/bin/activate

# 패키지 설치
pip install -r requirements.txt
```

### 2. 환경 변수 설정

프로젝트 루트의 `.env.local` 파일에 다음 변수들이 필요합니다:

```env
# FMP API 키
FMP_API_KEY=your_fmp_api_key

# Supabase 설정
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Supabase Storage 버킷 생성

Supabase 대시보드에서 `fmp-raw-data` 버킷을 생성해야 합니다.

## 사용법

### 티커 목록 수집 (월 1회)

S&P 500과 NASDAQ 100 종목 목록을 Wikipedia/GitHub에서 가져와 Storage에 저장합니다.

```bash
python fmp_data_collect.py --mode tickers
```

**저장 경로:**
- `fmp-raw-data/tickers/{year-month}/sp500.json`
- `fmp-raw-data/tickers/{year-month}/nasdaq100.json`
- `fmp-raw-data/tickers/{year-month}/all.json` (통합 목록)

### 재무제표 수집 (연 1회)

각 종목의 손익계산서, 재무상태표, 현금흐름표를 FMP API에서 가져옵니다.

```bash
# 전체 종목 수집 (500개 이상, 약 5시간 소요)
python fmp_data_collect.py --mode financials

# 종목 수 제한 (테스트용)
python fmp_data_collect.py --mode financials --limit 10
```

**저장 경로:**
- `fmp-raw-data/financials/{year}/{ticker}/income-statement.json`
- `fmp-raw-data/financials/{year}/{ticker}/balance-sheet.json`
- `fmp-raw-data/financials/{year}/{ticker}/cash-flow.json`

### 현재가 수집 (일간)

각 종목의 현재 주가와 기업 정보를 가져옵니다.

```bash
# 전체 종목 수집 (500개 이상, 약 100분 소요)
python fmp_data_collect.py --mode prices

# 종목 수 제한 (테스트용)
python fmp_data_collect.py --mode prices --limit 10
```

**저장 경로:**
- `fmp-raw-data/prices/{date}/{ticker}.json`

### 테스트 모드

5개 종목(AAPL, MSFT, GOOGL, NVDA, META)에 대해 재무제표와 현재가를 수집합니다.

```bash
python fmp_data_collect.py --mode test
```

## FMP 무료 요금제 제약

| 제약 | 값 | 대응 |
|------|-----|------|
| 일일 호출 | 250회 | 종목당 4 API = 최대 62종목/일 |
| 분당 호출 | 5회 | 12초 간격 딜레이 적용 |
| 데이터 기간 | 5년 | 버핏 평가에 충분 |

## 데이터 흐름

```
[1단계: 수집 (이 스크립트)]
Wikipedia/GitHub ──→ tickers/*.json (Storage)
FMP API ──────────→ financials/{year}/{ticker}/*.json (Storage)
FMP API ──────────→ prices/{date}/{ticker}.json (Storage)

[2단계: 평가 (buffett_evaluate.py)]
Storage 읽기 ──→ 버핏 점수 계산 ──→ buffett_result (DB)
                                   ──→ latest_price (DB)
```

## 스케줄링 (권장)

### Windows 작업 스케줄러

```
# 티커 목록: 매월 1일 09:00
schtasks /create /tn "FMP_Tickers" /tr "python C:\path\to\fmp_data_collect.py --mode tickers" /sc monthly /d 1 /st 09:00

# 현재가: 매일 22:00 (미국 장 마감 후)
schtasks /create /tn "FMP_Prices" /tr "python C:\path\to\fmp_data_collect.py --mode prices" /sc daily /st 22:00
```

### Linux Cron

```bash
# 티커 목록: 매월 1일 09:00
0 9 1 * * cd /path/to/scripts && python fmp_data_collect.py --mode tickers

# 현재가: 매일 22:00
0 22 * * * cd /path/to/scripts && python fmp_data_collect.py --mode prices

# 재무제표: 매년 1월 15일 09:00
0 9 15 1 * cd /path/to/scripts && python fmp_data_collect.py --mode financials
```

## 문제 해결

### 환경 변수 오류

```
❌ 필수 환경 변수가 설정되지 않았습니다
```

→ `.env.local` 파일에 `FMP_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 있는지 확인

### Rate Limit 오류

```
⏳ Rate Limit 도달. 60초 대기 중...
```

→ 정상 동작. 자동으로 60초 대기 후 재시도합니다.

### Storage 저장 실패

```
❌ Storage 저장 실패: Bucket not found
```

→ Supabase 대시보드에서 `fmp-raw-data` 버킷을 생성해주세요.
