# XRP Cron 구현 로드맵

USDT 대신 XRP(XRP/USDT)로 구현. Binance XRPUSDT에서 OHLC 수집 → btc_ohlc 저장 → 정산.

ETH 구현 시 고려했던 모든 항목을 포함합니다.

---

## 1. 현재 상태 요약

### ✅ 이미 있는 인프라 (재사용)
- **btc_ohlc 테이블**: `market` 컬럼으로 시장 구분 (xrp_1d, xrp_4h 등 추가만 하면 됨)
- **Binance API**: XRPUSDT 심볼 지원 (coin-market-sentiment에서 이미 사용 중)
- **cron 인증**: `isCronAuthorized`, `recordCronError` 등 공통

### ❌ XRP 시장이 아직 없는 부분 (전부 추가 필요)
- **sentiment-markets**: SENTIMENT_MARKETS, MARKET_CLOSE_KST, MARKET_LABEL, MARKET_SECTIONS 등에 xrp_* 추가
- **btc-klines**: MARKET_TO_SYMBOL, MARKET_TO_INTERVAL, KST_ALIGNED_MARKETS에 xrp_* 추가
- **candle-utils**: getCurrentCandleStartAt, getRecentCandleStartAts, getCandlesForPollDate 등 xrp_* 추가
- **settlement-service**: COIN_MARKETS_SETTLE, BACKFILL_MARKETS에 xrp 추가
- **sentiment-vote**: getCoin1dCloseUtcMs, isCoin1d 등에 xrp_1d 추가
- **poll-date-display**: COIN_1D_MARKETS에 xrp_1d 추가
- **vote-history**: COIN_MARKETS에 xrp 추가
- **btc_ohlc repository**: getOhlcByMarketAndCandleStart fallback에 xrp_1d 추가
- **predict 페이지**: COIN_MARKETS_FOR_VOTE, binanceSymbol(XRPUSDT), CARD_TITLE, pairMarkets 등
- **VotingSection, MarketVoteCardCompact, MarketVoteCard, PollRulesContent**: xrp 시장 UI
- **MarketIcon, UnsettledVotesTab, admin/unsettled-polls**: xrp_* 옵션
- **poll-server, sentiment/poll, sentiment/vote, sentiment/vote/cancel**: xrp 시장 허용
- **polls/today-results, leaderboard/top30**: xrp 시장 지원

### ❌ Cron 전용 (추가 필요)
- XRP cron API 라우트 5개
- cron-health 모니터링에 xrp 시장 추가
- unsettled-polls JOB_TO_MARKET에 xrp 매핑
- CronStatusPanel JOBS에 XRP 5개 job 추가

---

## 2. 구현 작업 목록

### Phase 0: XRP 시장 인프라 추가 (USDT 패턴 참고)

| # | 파일 | 변경 내용 |
|---|------|-----------|
| 0-1 | `src/lib/constants/sentiment-markets.ts` | SENTIMENT_MARKETS, MARKET_CLOSE_KST, MARKET_LABEL에 xrp_1d, xrp_4h, xrp_1h, xrp_15m, xrp_5m 추가; normalizeToDbMarket에 `xrp` → `xrp_1d` |
| 0-2 | `src/lib/binance/btc-klines.ts` | MARKET_TO_INTERVAL, MARKET_TO_SYMBOL, KST_ALIGNED_MARKETS에 xrp_* 추가 (심볼: XRPUSDT) |
| 0-3 | `src/lib/btc-ohlc/candle-utils.ts` | getCurrentCandleStartAt, getRecentCandleStartAts, getCandlesForPollDate, CANDLE_PERIOD_MS 등에 xrp_* 추가 |
| 0-4 | `src/lib/sentiment/settlement-service.ts` | COIN_MARKETS_SETTLE, BACKFILL_MARKETS에 xrp 추가 |
| 0-5 | `src/lib/utils/sentiment-vote.ts` | getCoin1dCloseUtcMs, isCoin1d 등에 xrp_1d 추가 |
| 0-6 | `src/lib/utils/poll-date-display.ts` | COIN_1D_MARKETS에 xrp_1d 추가 |
| 0-7 | `src/lib/btc-ohlc/repository.ts` | fallback에 xrp_1d 추가 |
| 0-8 | `src/app/api/profile/vote-history/route.ts` | COIN_MARKETS에 xrp 추가 |
| 0-9 | `src/app/predict/[market]/page.tsx` | COIN_MARKETS_FOR_VOTE, binanceSymbol, CARD_TITLE, pairMarkets, isTradingViewMarket 등 |
| 0-10 | `src/components/home/VotingSection.tsx` | COIN 필터 markets에 xrp_* 추가 |
| 0-11 | `src/components/home/MarketVoteCardCompact.tsx` | CARD_TITLE_LINE1에 xrp_* 추가 |
| 0-12 | `src/components/home/MarketVoteCard.tsx` | CARD_TITLE_LINE2 등 xrp_* 추가 |
| 0-13 | `src/components/predict/PollRulesContent.tsx` | RULES_BY_MARKET에 xrp_* 규칙 추가 |
| 0-14 | `src/components/market/MarketIcon.tsx` | xrp 시장 아이콘·라벨 추가 |
| 0-15 | `src/app/api/sentiment/poll/route.ts` | COIN_MARKETS에 xrp 추가 |
| 0-16 | `src/app/api/sentiment/vote/route.ts` | COIN_MARKETS에 xrp 추가 |
| 0-17 | `src/app/api/sentiment/polls/today-results/route.ts` | COIN_MARKETS, poll_date 로직에 xrp_1d 추가 |
| 0-18 | `src/app/api/leaderboard/top30/route.ts` | COIN_MARKETS에 xrp 추가 |
| 0-19 | `src/lib/sentiment/poll-server.ts` | xrp_* 시장 지원 |
| 0-20 | `src/components/admin/UnsettledVotesTab.tsx` | xrp_* 옵션 추가 |
| 0-21 | `src/app/api/admin/unsettled-polls/route.ts` | xrp_* 필터 추가 |
| 0-22 | `src/components/predict/TradingViewChart.tsx` | TV_SYMBOL에 xrp_* (BINANCE:XRPUSDT) 추가 |
| 0-23 | `src/lib/tier/constants.ts` | xrp_* tier 매핑 추가 |

---

### Phase 1: Cron API 라우트 생성 (eth 복사 → xrp 치환)

| # | 파일 경로 | 설명 |
|---|-----------|------|
| 1 | `src/app/api/cron/xrp-ohlc-daily/route.ts` | 매일 KST 09:00, xrp_1d 수집·정산 |
| 2 | `src/app/api/cron/xrp-ohlc-4h/route.ts` | 4시간마다, xrp_4h |
| 3 | `src/app/api/cron/xrp-ohlc-1h/route.ts` | 1시간마다, xrp_1h |
| 4 | `src/app/api/cron/xrp-ohlc-15m/route.ts` | 15분마다, xrp_15m |
| 5 | `src/app/api/cron/xrp-ohlc-5m/route.ts` | 5분마다, xrp_5m |

**치환 규칙**: `eth` → `xrp`, `ETH` → `XRP`, `eth_` → `xrp_`

---

### Phase 2: 모니터/헬스 연동

| # | 파일 | 변경 내용 |
|---|------|-----------|
| 6 | `src/app/api/monitor/cron-health/route.ts` | markets에 xrp_5m~xrp_1d 추가, switch에 xrp_* case |
| 7 | `src/app/api/monitor/unsettled-polls/route.ts` | JOB_TO_MARKET에 xrp-ohlc-* 5개 매핑 |
| 8 | `src/components/admin/CronStatusPanel.tsx` | JOBS에 XRP 5개 job 추가 |

---

### Phase 3: cron-job.org 설정

| Job | URL | 권장 스케줄 |
|-----|-----|-------------|
| xrp-ohlc-daily | `/api/cron/xrp-ohlc-daily` | 매일 09:00 KST |
| xrp-ohlc-4h | `/api/cron/xrp-ohlc-4h` | 4시간마다 |
| xrp-ohlc-1h | `/api/cron/xrp-ohlc-1h` | 1시간마다 |
| xrp-ohlc-15m | `/api/cron/xrp-ohlc-15m` | 15분마다 |
| xrp-ohlc-5m | `/api/cron/xrp-ohlc-5m` | 5분마다 |

**인증**: `Authorization: Bearer <CRON_SECRET>` 또는 `x-cron-secret` 헤더

---

## 3. XRP 특이사항

### 3.1 데이터 소스
- **Binance 심볼**: `XRPUSDT` (BTC/ETH와 동일한 USDT 페어)
- **btc_ohlc**: `market` = xrp_1d, xrp_4h, xrp_1h, xrp_15m, xrp_5m

### 3.2 마감 시간
- 1일봉: KST 09:00 = UTC 00:00 (btc/eth와 동일)
- 4h/1h/15m/5m: 롤링 마감 (봉 종료 시점)

### 3.3 USDT와의 차이
- USDT: USDTBUSD (스테이블코인, USDT/KRW 환산 목적이었으나 미적용)
- XRP: XRPUSDT (일반 코인, BTC/ETH와 동일한 OHLC 수집·정산 패턴)

---

## 4. 체크리스트

- [x] Phase 0: XRP 시장 인프라 23개 파일 수정
- [x] Phase 1: 5개 cron 라우트 생성 및 빌드 통과
- [x] Phase 2: 모니터 3개 파일 수정
- [ ] Phase 3: cron-job.org 5개 job 등록
- [ ] 수동 호출로 수집·정산 동작 확인
- [ ] 전적 페이지에서 xrp 투표 시가·종가·가격변동률 표시 확인
