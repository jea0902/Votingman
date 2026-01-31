# Supabase Storage 설정 가이드

## 1. 버킷 생성

Supabase 대시보드에서:

1. **Storage** 메뉴로 이동
2. **New bucket** 클릭
3. 버킷 이름: `fmp-raw-data`
4. **Public bucket**: ❌ 비공개 (원본 데이터는 민감할 수 있음)
5. **File size limit**: 필요에 따라 설정 (기본값 사용 가능)
6. **Allowed MIME types**: `application/json` 또는 모든 타입 허용

## 2. Storage 정책 설정 (RLS)

Supabase Storage는 RLS(Row Level Security)를 사용합니다.

### 서버에서만 접근 가능하도록 설정:

```sql
-- Storage 정책: service_role만 접근 가능
CREATE POLICY "Service role can manage fmp-raw-data"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'fmp-raw-data');

-- 또는 anon 키로도 읽기만 허용하려면:
CREATE POLICY "Public read access to fmp-raw-data"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'fmp-raw-data');
```

## 3. 스토리지 구조

```
fmp-raw-data/
├── 2025-01-28/
│   ├── AAPL/
│   │   ├── profile.json
│   │   ├── income-statement.json
│   │   ├── balance-sheet.json
│   │   ├── cash-flow.json
│   │   └── key-metrics.json
│   ├── MSFT/
│   │   └── ...
│   └── GOOGL/
│       └── ...
├── 2025-01-29/
│   └── ...
```

## 4. 사용 예시

```typescript
import { saveFmpRawData, getFmpRawData } from "@/lib/supabase/storage";

// FMP API에서 받은 데이터 저장
await saveFmpRawData("AAPL", "profile", "2025-01-28", {
  symbol: "AAPL",
  companyName: "Apple Inc.",
  // ... FMP API 응답 데이터
});

// 저장된 데이터 조회
const profile = await getFmpRawData("AAPL", "profile", "2025-01-28");
```

## 5. 무료 요금제 제한

- **Storage 용량**: 1GB (무료)
- **Bandwidth**: 2GB/월 (무료)
- **파일 크기**: 최대 50MB

FMP API 원본 데이터는 보통 작으므로 무료 요금제로 충분합니다.
