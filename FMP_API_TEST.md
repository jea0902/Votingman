# FMP API 테스트 가이드

## 1. 환경 변수 설정

`.env.local`에 FMP API Key 추가:

```bash
FMP_API_KEY=your_api_key_here
```

## 2. 테스트 API 엔드포인트

### 기본 사용법

```
GET /api/fmp/test?ticker=AAPL&endpoint=profile
```

### 파라미터

- `ticker` (선택): 종목 티커 (기본값: `AAPL`)
- `endpoint` (선택): 데이터 타입 (기본값: `profile`)

### 지원하는 endpoint

- `profile` - 회사 프로필
- `income-statement` - 손익계산서
- `balance-sheet` - 재무상태표
- `cash-flow` - 현금흐름표
- `key-metrics` - 주요 지표
- `company-key-metrics` - 회사 주요 지표 (TTM)
- `ratios` - 재무 비율 (TTM)
- `enterprise-value` - 기업가치

## 3. 테스트 예시

### 로컬에서 테스트

```bash
# 1. 개발 서버 실행
npm run dev

# 2. 브라우저에서 접속
http://localhost:3000/api/fmp/test?ticker=AAPL&endpoint=profile
```

### Vercel 배포 후 테스트

```
https://your-domain.vercel.app/api/fmp/test?ticker=AAPL&endpoint=profile
```

## 4. 응답 예시

### 성공 응답

```json
{
  "ok": true,
  "ticker": "AAPL",
  "endpoint": "profile",
  "dataLength": 1,
  "preview": {
    "symbol": "AAPL",
    "price": 185.50,
    "beta": 1.25,
    "volAvg": 50000000,
    ...
  },
  "data": { ... }
}
```

### 에러 응답

```json
{
  "ok": false,
  "error": "FMP API error: 401 Unauthorized",
  "hint": "FMP_API_KEY가 .env.local에 설정되어 있는지 확인하세요."
}
```

## 5. 직접 FMP API 호출 테스트 (cURL)

```bash
# Profile 조회
curl "https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=YOUR_API_KEY"

# Income Statement 조회
curl "https://financialmodelingprep.com/api/v3/income-statement/AAPL?apikey=YOUR_API_KEY"

# 헤더 인증 사용
curl -H "apikey: YOUR_API_KEY" \
  "https://financialmodelingprep.com/api/v3/profile/AAPL"
```

## 6. 무료 요금제 제한

- **250 calls/day**
- **5 calls/minute**

테스트 시 rate limit에 주의하세요!
