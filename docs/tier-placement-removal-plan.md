# 배치·티어 제거 계획 (MMR 유지)

MMR은 그대로 사용하고, **배치 시스템(placement)** 과 **티어 시스템(tier)** 만 제거할 때의 수정 지침입니다.

---

## 1. 목표

- **유지**: MMR 계산·저장·리더보드 순위
- **제거**: 배치(placement_matches_played, placement_done, N경기 완료 후 랭크) 개념
- **제거**: 티어(gold/platinum/diamond/master/challenger) 부여 및 표시

---

## 2. DB

- **마이그레이션 불필요.** `user_season_stats`의 `placement_*`, `tier` 컬럼은 그대로 두고, 코드에서만 의미를 제거합니다.
- 저장 시: `placement_done = true`, `placement_matches_played = 실제 참여 수`, `tier = null` 로만 쓰면 됩니다.

---

## 3. 백엔드 수정

### 3.1 `src/lib/tier/constants.ts`

- **삭제 또는 주석**: `PLACEMENT_MATCHES_REQUIRED`, `TIER_PERCENTILE_CUTOFFS`
- 유지: `TIER_MARKET_ALL`, `SENTIMENT_TO_TIER_MARKET`, `MMR_CLAMP_MIN/MAX`(MMR 보정 유지 시)

### 3.2 `src/lib/tier/tier-service.ts`

**A. `refreshMarketSeason` (배치·티어 로직 제거)**

- `placement_done`: 항상 `true`로 설정 (참여 1경기 이상이면 MMR 부여).
- `placement_matches_played`: 기존처럼 `played` 그대로 저장.
- MMR 계산:
  - `mmr = played > 0 ? balance * win_rate : 0` (배치 N경기 조건 제거).
  - 이전 시즌 보정(클램프) 유지할지 선택. 유지하면 `prev_season_mmr` 로직 그대로 두고, `placement_done` 체크만 제거.
- **티어 부여 루프 제거**: `TIER_PERCENTILE_CUTOFFS`로 `tier` 할당하는 for 루프 전체 삭제. 모든 행에 `tier: null` 저장.
- upsert 시 `tier: null` 고정.

**B. `getOrCreateUserMarketSeason` (단일 유저 계산)**

- `placement_done`: 항상 `true` (또는 `placement_matches_played >= 1`).
- `tier`: 항상 `null`.
- MMR: 위와 동일하게 “참여 있으면 balance * win_rate”.

**C. `getMyTierStats`**

- “배치 완료 + 티어 없으면 refresh” 조건 제거: `needRefresh = existing.placement_done && !existing.tier` 삭제. 티어 갱신 호출 제거.
- 새 행 upsert 시 `tier: preserveTier` 대신 `tier: null`.
- 반환 타입/필드는 그대로 둬도 되고, API에서 안 쓰면 나중에 제거 가능.

**D. `getMarketPercentile`**

- `placement_done` 필터 제거하거나, “참여 1경기 이상” 등 단일 조건으로 통일. (MMR이 0이 아닌 유저만 상위% 계산하면 됨.)

**E. `addPercentilesToMarkets`**

- `m.placement_done` 조건 제거: MMR이 숫자이면 percentile 계산.

**F. 타입 `UserMarketStats`**

- `placement_done`, `placement_matches_played`, `tier`는 DB 스키마 호환을 위해 유지해도 됨. 반환에서만 사용 중단 가능.

### 3.3 `src/app/api/rank/me/route.ts`

- 응답에서 **선택**:
  - **옵션 A**: `placement_matches_played`, `placement_done`, `tier` 필드 제거. `season_id`, `markets[].market`, `season_win_count`, `season_total_count`, `win_rate`, `mmr`, `percentile_pct`만 반환.
  - **옵션 B**: 필드는 유지하되 `placement_done: true`, `tier: null` 고정 반환. 프론트에서 이 필드를 더 이상 쓰지 않음.

### 3.4 `src/app/api/rank/refresh/route.ts`

- 변경 없음. `refreshMarketSeason`만 호출하며, 위 수정 후에는 MMR/승패만 갱신되고 티어는 더 이상 부여되지 않음.

### 3.5 정산/크론 (`settle`, `btc-ohlc-*` 등)

- `refreshMarketSeason` 호출은 그대로 두면 됨. 배치/티어 제거는 tier-service 내부에서만 처리.

---

## 4. 프론트엔드 수정

### 4.1 `src/components/home/UserInfoCard.tsx`

- **티어 로고 제거**: `TIER_LOGO`, `TIER_LOGO_BEGINER` 사용처 제거. 대신 “랭크” 또는 “MMR” 라벨만 두거나, 단순 아이콘/텍스트로 대체.
- **티어 이름 제거**: “배치 진행 중”, “골드/플래티넘/…” 문구 제거.
- **배치 N/5 제거**: “배치 3/5” 같은 표시 제거.
- **표시할 것**: 시즌 라벨, 닉네임, **승률**, **전적(N승 M패)**, **MMR**(선택), 가용 코인. “통합 랭크” 박스에는 예: “MMR 1,234” 또는 “승률 65% · 13승 7패”만 표시.
- 비로그인 문구: “티어·MMR·승률로…” → “MMR·승률로…” 등으로 수정.
- API 응답에서 `placement_done`, `tier` 제거했다면, 해당 필드를 참조하는 타입/변수도 정리.

---

## 5. 작업 순서 제안

1. **tier-service**: `refreshMarketSeason`에서 티어 부여 제거, 배치 조건 제거(항상 placement_done=true, MMR=balance*win_rate).
2. **tier-service**: `getOrCreateUserMarketSeason` / `getMyTierStats`에서 배치·티어 의존 제거.
3. **constants**: `PLACEMENT_MATCHES_REQUIRED`, `TIER_PERCENTILE_CUTOFFS` 제거 또는 미사용 처리.
4. **API rank/me**: 응답에서 tier·placement 필드 제거 또는 고정값.
5. **UserInfoCard**: 티어·배치 UI 제거, MMR·승률·전적만 표시.
6. (선택) `getMarketPercentile` / `addPercentilesToMarkets`에서 placement_done 조건 제거.

---

## 6. 테스트

- 정산 후 `user_season_stats`: `mmr` 값 존재, `tier`는 null.
- 리더보드: MMR 내림차순 순위 유지.
- GET `/api/rank/me`: 응답에 tier/placement 미표시 또는 null/고정값.
- 홈 유저 카드: 티어/배치 문구 없음, MMR·승률·전적만 표시.

이 순서대로 적용하면 MMR은 그대로 두고 배치·티어만 제거할 수 있습니다.

---

## 7. 적용 완료 후 수동으로 할 일

코드 수정은 위 순서대로 반영된 상태입니다. 아래만 확인·선택하면 됩니다.

1. **DB**
   - 마이그레이션은 하지 않아도 됨. 기존 `user_season_stats`의 `placement_*`, `tier` 컬럼은 그대로 두고, 앞으로는 `placement_done = true`, `tier = null`만 저장됨.
   - (선택) 나중에 DB 정리 시 `placement_matches_played`, `placement_done`, `tier` 컬럼을 제거하는 마이그레이션을 넣을 수 있음. 지금은 필수 아님.

2. **기존 데이터**
   - 이미 저장된 행의 `tier` 값(골드/다이아 등)은 더 이상 사용하지 않음. 화면에는 MMR·승률만 나옴.
   - 다음 정산 또는 `POST /api/rank/refresh` 실행 시 해당 시즌 전체가 MMR만 갱신되고 `tier`는 null로 덮어써짐. 별도 배치 작업은 필요 없음.

3. **배포 후 확인**
   - 로그인 → 홈: 유저 카드에 티어/배치 문구 없이 MMR·승률·전적만 나오는지 확인.
   - `GET /api/rank/me`: 응답에 `placement_*`, `tier` 필드가 없고, `mmr`, `win_rate`, `percentile_pct` 등만 있는지 확인.
   - 리더보드: MMR 순위가 기존과 같이 동작하는지 확인.

4. **에셋 정리 (선택)**
   - `public/images/tier_logos/` (골드/플래티넘/다이아 등 티어 이미지)는 더 이상 참조하지 않음. 디스크 용량이 아깝다면 삭제해도 됨.
