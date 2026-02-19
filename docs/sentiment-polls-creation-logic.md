# sentiment_polls에 데이터가 남는 로직

## 1. INSERT가 일어나는 곳 (유일)

- **파일**: `src/lib/sentiment/poll-server.ts`
- **함수**: `getOrCreatePollByMarketAndCandleStartAt(market, candleStartAt, pollDate?)`
  - `sentiment_polls`에서 `(market, candle_start_at)`으로 조회
  - **이미 행이 있으면** → 그대로 반환 (created: false)
  - **없으면** → **INSERT 1건** 후 반환 (created: true)

즉, **다른 곳에서는 sentiment_polls에 INSERT하지 않음.** 모든 행은 이 함수를 통해서만 생김.

---

## 2. getOrCreatePollByMarketAndCandleStartAt을 호출하는 경로

### (A) getOrCreateTodayPollByMarket(market)

- **의미**: "오늘(KST) **현재 진행 중인 캔들 1개**"에 대한 폴 조회/생성
- **candle_start_at**: `getCurrentCandleStartAt(market)` → **지금 시각 기준 현재 봉** 1개만 사용
- **호출하는 API/코드**:
  - `GET /api/sentiment/poll?market=...` — 투표 페이지에서 현재 폴 조회
  - `GET /api/sentiment/polls` — 여러 시장 오늘 폴 한 번에 조회
  - `POST /api/sentiment/vote` — 투표 시 (해당 시장 현재 폴 확보)
  - `POST /api/sentiment/vote/cancel` — 투표 취소 시
  - `GET /api/leaderboard/top20` — 리더보드에서 오늘 폴 사용

**결과**: 시장당 **현재 진행 중인 봉 1개**에 대한 행만 생성됨.  
예: btc_15m에서 10:00에 접속하면 `10:00~10:15` 봉 폴만 생기고, `00:00~00:15`, `00:15~00:30` … 는 **절대 이 경로로는 생성되지 않음.**

### (B) getOrCreatePollByDateAndMarket(pollDate, market)

- **의미**: 특정 `poll_date` + `market`에 해당하는 **캔들 중 첫 번째 1개**만 조회/생성
- **동작**: `getCandlesForPollDate(market, pollDate)`로 그날 캔들 목록을 가져온 뒤 **`candleStartAts[0]` 하나만** 사용해 `getOrCreatePollByMarketAndCandleStartAt` 호출
- **실제 호출처**: `POST /api/cron/btc-ohlc-backfill` 루트 **한 곳뿐**
- **backfill에서의 사용**:
  - `getOrCreatePollByDateAndMarket(pollDate, "btc_1d")` **만** 호출 (날짜당 1번, btc_1d만)
  - btc_4h, btc_1h, btc_15m은 backfill에서 **OHLC만 upsert**하고, **이 함수는 호출하지 않음**

**결과**: btc_1d는 backfill 시 그날 폴 1개가 생성될 수 있음.  
btc_4h/1h/15m은 **이 경로로는 어디에서도 폴이 생성되지 않음.**

---

## 3. 정산(settle)과의 관계

- **파일**: `src/lib/sentiment/settlement-service.ts` — `settlePoll(pollDate, market, candle_start_at?)`
- **동작**: `sentiment_polls`에서 `(market, candle_start_at)`으로 **조회만** 함
  - **폴이 있으면** → 정산 실행 (settled_at 갱신, payout 등)
  - **폴이 없으면** → "폴을 찾을 수 없습니다" 반환, **폴을 새로 만들지 않음**

즉, **정산은 이미 존재하는 폴만 처리**하고, sentiment_polls 행을 새로 만드는 역할은 하지 않음.

---

## 4. 요약 표

| 경로 | 생성되는 폴 |
|------|-------------|
| 투표 페이지/폴 API/투표·취소/리더보드 | **오늘 현재 진행 중인 봉 1개** (시장당) |
| btc-ohlc-backfill | **btc_1d만**, 해당 날짜 봉 1개 |
| 정산(settle) | 생성 없음 (기존 폴만 처리) |

- **btc_15m**: 매 15분마다 "현재 봉"이 바뀌므로, **그때마다 누군가 해당 시장 폴을 조회/투표해야** 그 15분 봉에 대한 행이 생김.  
- **00:00~00:15, 00:15~00:30 …** 처럼 과거 봉에 대한 폴은 **어떤 API/크론도 만들지 않음.**

---

## 5. btc_ohlc와의 관계

- **btc_ohlc**는 매 15분(또는 시장별 주기) 크론으로 **캔들 OHLC가 기록**됨.
- **결과(상승/하락/동일가)** 는 `open`(reference) vs `close`(settlement)만 있으면 계산 가능하므로, **sentiment_polls에 폴이 없어도 btc_ohlc만으로 "당일 결과"를 보여줄 수 있음.**

따라서 **과거 정산 결과를 보여주는 로직은 sentiment_polls가 아니라 btc_ohlc 기반으로 작성하는 것이 맞음.**
