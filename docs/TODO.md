# 보팅맨 TODO 리스트

> 작성일: 2026-03-01  
> 회원가입, 투표 기능 관련 추가 개발 항목

---

## 0. 투표 기능 최종 점검 및 Binance API 대체 대응 ✅

- [x] **목표**: 투표 기능이 제대로 수집·정산되는지 최종 확인
- [x] 수집 검증: 1일/4시간/1시간/15분봉 cron 정상 동작 확인
- [x] 정산 검증: payout_history, 승률, 무효 처리 등 로직 최종 점검
- [x] **과거 BTC 가격 데이터 백필**: 가능한 범위까지 btc_ohlc 백필 실행
- [x] **Binance API 장애 대응**:
  - [x] 관리자 백필 후 정산 기능 (OHLC 수집 → 정산)
  - [x] 관리자 무효 처리 + 집계 초기화

---

## 1. 늦은 투표 비용 증가 (로우 리스크 로우 리턴) ✅

- [x] **목표**: 마감 시간에 가까울수록 더 큰 비용을 내게 만들기
- [x] 설계: 구간별 고정 배수
- [x] 구현: getLateVotingMultiplier, vote API 검증
- [x] UI: 투표 상세 페이지 배수 표시, 확인 팝업, 잔액 부족 처리

**구간별 고정 배수**:
- 50% 이상 남음: 1배
- 25~50%: 1.5배
- 10~25%: 3배
- 0~10%: 5배
- 0%: 마감 (투표 불가)

---

## 2. 비트코인 5분봉 추가 ✅

- [x] **목표**: 현재 BTC 1일/4시간/1시간/15분 → 5분봉 1개 추가
- [x] Binance API 5분봉 데이터 수집 (btc_5m → "5m" interval)
- [x] sentiment_markets 상수 추가
- [x] cron route: `GET /api/cron/btc-ohlc-5m` (5분마다 실행)
- [x] 투표 UI 연동
- [ ] **cron-job.org**: 5분마다 `https://<도메인>/api/cron/btc-ohlc-5m` 호출 추가 (Header: x-cron-secret)

---

## 3. 코스피(KOSPI) 시장 추가

- [ ] **목표**: KOSPI 1일봉, 4시간봉, 1시간봉, 15분봉, 5분봉
- [ ] OHLC 데이터 소스 확정 (한국거래소/외부 API)
- [ ] btc_ohlc → 시장별 테이블 또는 market 컬럼 확장
- [ ] sentiment_polls 생성 로직
- [ ] cron job 설정

---

## 4. 코스닥(KOSDAQ) 시장 추가

- [ ] **목표**: KOSDAQ 1일봉, 4시간봉, 1시간봉, 15분봉, 5분봉
- [ ] OHLC 데이터 소스 확정
- [ ] 데이터 수집/정산 파이프라인

---

## 5. 나스닥(NASDAQ) 시장 추가

- [ ] **목표**: NASDAQ 1일봉, 4시간봉, 1시간봉, 15분봉, 5분봉
- [ ] OHLC 데이터 소스 확정 (예: Yahoo Finance, Alpha Vantage 등)

---

## 6. S&P 500 시장 추가

- [ ] **목표**: S&P 500 1일봉, 4시간봉, 1시간봉, 15분봉, 5분봉
- [ ] OHLC 데이터 소스 확정

---

## 7. 투표 페이지 필터링 UI (시장별 가로 박스)

- [ ] **목표**: 뉴스 탭 속보 페이지 스타일 참고
- [ ] 설계: 시장별 필터링 UI
- [ ] 각 시장: 시장 이름 + 해당 시장 투표지들 가로 1행 배치 (웹)
- [ ] 예: 비트코인 시장 → 5개 투표지(1일/4h/1h/15m/5m) 가로 스크롤

---

## 8. 투표지별 댓글 기능

- [ ] **목표**: 각 투표지마다 댓글 달 수 있게
- [ ] DB: comments 테이블 설계
- [ ] API: 댓글 CRUD
- [ ] UI: 댓글 입력/목록/수정/삭제

---

## 9. AI 자동 투표 기능

- [ ] **목표**: GPT, Gemini, Claude, Grok 등 AI가 자동으로 투표
- [ ] 각 AI별 별도 계정 생성
- [ ] 설계: AI가 어떻게 자체 판단하여 투표할지 로직 정의
- [ ] 구현: 시장 데이터 → AI API 호출 → 결과 분석 → 투표 실행
- [ ] 자동화: 스케줄/트리거 설정

---

## 10. 회원가입 - 네이버 클라우드 SENS 연동

- [ ] **목표**: 사업자 등록 확정 후 SENS 연동, 전체 계정 초기화
- [ ] SENS API 연동 (문자 인증)
- [ ] 회원가입 플로우: 개인정보 동의 + 휴대폰 인증까지
- [ ] 기존 계정 전체 삭제: `reset-all-users-for-sens.sql` 실행
- [ ] 신규 회원가입 플로우 테스트

---

## 11. 유저 경험 E2E 테스트 (처음부터 끝까지)

- [ ] **목표**: 투표 기능이 회원가입부터 정산·전적 확인까지 전 구간에서 정상 동작하는지 검증

### 11.1 회원가입·로그인

- [ ] 회원가입 (이메일/비밀번호 또는 소셜 로그인)
- [ ] 로그인 후 메인/프로필 접근
- [ ] VTC 초기 지급 확인 (있다면)

### 11.2 투표 플로우

- [ ] 시장 선택 (btc_1d, btc_4h, btc_1h, btc_15m 중 1개)
- [ ] 롱/숏 선택 + 배팅 금액 입력
- [ ] 확정 버튼 클릭 → 투표 완료
- [ ] 추가 투표 (같은 폴에 추가 배팅) → 확정 버튼 동작
- [ ] 마감 임박 시 배수 표시 확인 (1.5배, 3배, 5배 등)
- [ ] 잔액 부족 시 에러 처리

### 11.3 정산 대기·결과 확인

- [ ] 봉 마감 후 cron 실행 대기 (15m: 15분, 1h: 1시간, 4h: 4시간, 1d: 09:00 KST)
- [ ] 알림: 승리 시 `+X.XX VTC`, 패배 시 `-X.XX VTC`, 무효 시 `원금 반환` 표시
- [ ] 프로필 전적: 승/패/무효 정확히 표시
- [ ] 프로필 전적: payout_amount (+수익 / -배팅) 표시
- [ ] 누적 승률 반영

### 11.4 VTC 잔액·지급 검증

- [ ] 승리 시: users.voting_coin_balance += (원금 + 수익) × 0.99
- [ ] 패배 시: 잔액 변화 없음
- [ ] 무효 시: 원금 환불

### 11.5 검증 SQL (Supabase)

```sql
-- 최근 정산 + 승자/패자 + 지급액 확인
WITH recent AS (
  SELECT id, market, candle_start_at, settled_at
  FROM sentiment_polls
  WHERE settled_at IS NOT NULL
  ORDER BY settled_at DESC
  LIMIT 10
)
SELECT p.market, p.candle_start_at, v.choice, v.bet_amount,
  ph.payout_amount AS profit,
  CASE WHEN ph.payout_amount > 0 THEN v.bet_amount + ph.payout_amount ELSE 0 END AS should_receive
FROM recent p
JOIN sentiment_votes v ON v.poll_id = p.id AND v.bet_amount > 0
LEFT JOIN payout_history ph ON ph.poll_id = p.id AND ph.user_id = v.user_id
ORDER BY p.settled_at DESC, ph.payout_amount DESC NULLS LAST;
```

### 11.6 체크리스트 요약

| 단계 | 확인 항목 |
|------|----------|
| 1. 회원가입 | 가입·로그인 성공 |
| 2. 투표 | 롱/숏 선택, 배팅, 확정, 추가 투표 |
| 3. 정산 | 알림 수신, 전적 반영, payout 표시 |
| 4. VTC | 잔액 증가(승리), 검증 SQL |

---

## 참고

- **뉴스 탭 속보 페이지**: 필터링 UI 참고용
- **reset-all-users-for-sens.sql**: 계정 초기화용 (이미 준비됨)
- **btc-ohlc-backfill API**: `/api/cron/btc-ohlc-backfill` - 과거 OHLC 백필용
- **cron-health API**: `/api/monitor/cron-health` - cron 수집 상태 모니터링
- **docs/voting-spec.md**: 투표·정산 명세 및 트러블슈팅
