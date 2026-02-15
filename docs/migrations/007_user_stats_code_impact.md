# 007 마이그레이션 적용 후 코드 수정 목록

`007_user_stats_rename_and_simplify.sql` 실행 후 아래처럼 코드를 맞춰야 합니다.

---

## 1. 테이블·컬럼 변경 요약

| 변경 | 내용 |
|------|------|
| 테이블명 | `user_season_stats` → `user_stats` |
| 삭제 컬럼 | `season_id`, `placement_matches_played`, `placement_done`, `prev_season_mmr`, `tier` |
| 리네임 | `season_win_count` → `win_count`, `season_total_count` → `participation_count` |
| 유니크 키 | `(user_id, market, season_id)` → `(user_id, market)` (시즌당 1행 → 시장당 1행) |

**삭제 컬럼 설명**
- `placement_done`: 예전 "배치 5판 완료 여부". 현재는 항상 true만 저장하므로 제거.
- `placement_matches_played`: 참여 횟수. `participation_count`(기존 `season_total_count`)와 동일 의미라 제거.
- 나머지: `season_id`, `prev_season_mmr`, `tier` — 요청대로 제거.

---

## 2. 수정할 파일 (반드시)

### 2.1 `src/lib/supabase/db-types.ts`
- `UserSeasonStatsRow` → `UserStatsRow` (또는 유지 시 타입만 변경)
- 테이블명 주석: `user_stats`
- 컬럼: `user_id`, `market`, `win_count`, `participation_count`, `mmr`, `updated_at` 만 사용
- `TierKey` 타입: 테이블에서 제거됐으므로 다른 곳에서만 쓰이면 유지, 아니면 제거 가능

### 2.2 `src/lib/tier/tier-service.ts`
- `.from("user_season_stats")` → `.from("user_stats")` (전체)
- `season_id` 조건/컬럼 제거 (select, upsert, eq 등)
- `placement_matches_played`, `placement_done`, `prev_season_mmr`, `tier` 제거
- `season_win_count` → `win_count`, `season_total_count` → `participation_count`
- upsert `onConflict`: `"user_id,market,season_id"` → `"user_id,market"`
- `getCurrentSeasonId()` 로 “현재 시즌” 행만 쓰는 로직 제거 (테이블에 시즌 없음)
- `getPrevSeasonId`, 이전 시즌 MMR 조회/보정 로직 제거 (prev_season_mmr 없음)
- 타입 `UserMarketStats`: `season_id`, `placement_*`, `prev_season_mmr`, `tier` 제거; `win_count`, `participation_count` 사용
- `computeUserMarketSeason` 반환: `placement_matches_played` 대신 참여 횟수만 `participation_count`로 전달
- MMR 계산: 기존과 동일 `balance * (win_count / participation_count)` (0 나누기 방지)

### 2.3 `src/app/api/leaderboard/top20/route.ts`
- `.from("user_season_stats")` → `.from("user_stats")`
- `.eq("season_id", seasonId)` 제거
- 조회 컬럼: `user_id`, `mmr` 등 필요 컬럼만 (season_id 없음)

### 2.4 `src/app/api/rank/me/route.ts`
- `getMyTierStats` 반환값이 `season_id` 제거·변경되면 응답 shape 조정
- `markets[].season_win_count` → `markets[].win_count`, `season_total_count` → `markets[].participation_count`
- API 응답에서 `season_id` 제거할지 결정 (제거 시 프론트도 수정)

### 2.5 `src/components/home/UserInfoCard.tsx`
- 타입/필드: `season_win_count` → `win_count`, `season_total_count` → `participation_count`
- `season_id` 사용처 제거 또는 옵션 필드로 처리

### 2.6 기타
- `src/app/api/rank/refresh/route.ts`: 응답/주석에서 `season_id` 등 제거
- `src/app/api/sentiment/settle/route.ts`: 주석 `user_season_stats` → `user_stats`
- `getCurrentSeasonId` import: 리더보드·tier-service 등에서 더 이상 user_stats 조회에 쓰지 않으면 제거 가능 (시즌 날짜 계산 등 다른 용도면 유지)

---

## 3. 삭제/변경 시 영향 정리

| 삭제/변경 | 영향 | 조치 |
|-----------|------|------|
| `season_id` 삭제 | 시즌별 행이 사라져 (user_id, market)당 1행만 존재 | 모든 select/upsert에서 season_id 조건·컬럼 제거; “현재 시즌” 개념은 앱에서만 사용 시 getCurrentSeasonId()로 표시용으로만 사용 |
| `placement_done` 삭제 | 없음 (항상 true만 저장하던 컬럼) | 코드에서 해당 필드 읽기/쓰기 제거 |
| `placement_matches_played` 삭제 | 참여 횟수는 `participation_count`로 대체 | 쓰는 곳을 `participation_count`로 변경 |
| `prev_season_mmr` 삭제 | 이전 시즌 MMR 보정(70%~130%) 불가 | tier-service에서 이전 시즌 조회·클램프 로직 제거, MMR = balance × 승률만 사용 |
| `tier` 삭제 | 이미 null만 저장, UI에서 미사용 | 타입·insert/select에서 tier 제거 |
| 테이블명 변경 | 모든 `.from("user_season_stats")` | `.from("user_stats")`로 일괄 변경 |
| `season_win_count` → `win_count` | API·타입·UI 필드명 | 일괄 리네임 |
| `season_total_count` → `participation_count` | 동일 | 일괄 리네임 |

---

## 4. 마이그레이션 후 검증

- [ ] `user_stats` 테이블만 존재하고 `user_season_stats` 없음
- [ ] (user_id, market)당 1행, market='all' 포함
- [ ] `mmr`가 0이 아닌 행 존재 (보유 코인·승률 반영)
- [ ] 리더보드 API: `user_stats` 기준 MMR 순 정상
- [ ] GET `/api/rank/me`: `win_count`, `participation_count`, `mmr` 정상
- [ ] 정산/refresh 후 `user_stats` upsert 정상 동작
