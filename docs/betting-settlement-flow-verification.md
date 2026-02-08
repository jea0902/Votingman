# 배팅·정산 시스템 end-to-end 검증 요약

## 1. 흐름 개요

```
[사용자] 2월 9일 배팅(롱/숏) 
  → POST /api/sentiment/vote 
  → 코인 차감, sentiment_votes 저장, sentiment_polls 집계 갱신

[매일 KST 00:01] Vercel Cron → GET /api/cron/btc-ohlc-daily
  → 어제(2월 9일) 폴: 시가·종가 Binance 조회 후 DB 반영
  → settlePoll(어제, btc) → 당첨자 잔액 지급, payout_history 기록, settled_at 설정
  → 오늘(2월 10일) 폴: 시가만 반영
  → 미정산 과거 폴(최근 7일) 재시도
```

## 2. 확인된 사항

| 구간 | 파일 | 확인 내용 |
|------|------|-----------|
| 배팅 | `src/app/api/sentiment/vote/route.ts` | 서버 세션으로 user 확인, KST 오늘 폴(`getOrCreateTodayPollByMarket`), 잔액 차감 → users, sentiment_votes insert/update, sentiment_polls 집계 update |
| 오늘 날짜 | `src/lib/binance/btc-kst.ts` | `getTodayKstDateString()` = KST 기준 YYYY-MM-DD |
| 투표 마감 | `src/lib/utils/sentiment-vote.ts` | `isVotingOpenKST(market)` = KST 기준 (비트코인 20:30 마감) |
| Cron 스케줄 | `vercel.json` | `"1 15 * * *"` = 매일 15:01 UTC = **00:01 KST** (접속 불필요, 완전 자동) |
| Cron 인증 | `btc-ohlc-daily/route.ts` | `CRON_SECRET` (Bearer 또는 x-cron-secret) |
| OHLC 반영 | `settlement-service.ts` | `updateBtcOhlcForPoll(pollDate, pollId)` = Binance 시가·종가 조회 후 sentiment_polls update |
| 정산 | `settlement-service.ts` | `settlePoll(pollDate, market)` = 이미 정산된 폴 스킵, 시가/종가 없으면 조회 시도, 무효판/한쪽 쏠림 환불, 정상 시 당첨자 원금+수령분 지급, payout_history insert, sentiment_polls.settled_at 설정 |
| Cron에서 정산 호출 | `btc-ohlc-daily/route.ts` | 어제 OHLC 반영 직후 `settlePoll(yesterday, "btc")` 호출 |
| 미정산 재시도 | `btc-ohlc-daily/route.ts` | settled_at null 이고 poll_date < 오늘, 최근 7일 폴에 대해 settlePoll 재시도 |

## 3. 2월 9일 배팅 → 정산 타이밍

- **2월 9일**: 두 계정으로 롱/숏 각각 배팅 → `poll_date=2026-02-09` 폴에 투표 기록.
- **2월 10일 00:01 KST**: Cron 실행  
  - yesterday = 2026-02-09  
  - 2월 9일 폴 시가·종가 반영 후 `settlePoll("2026-02-09", "btc")` 실행  
  - 종가 > 시가 → 롱 당첨, 종가 ≤ 시가 → 숏 당첨  
  - 당첨자: 원금 + (패자 풀 × 본인 베팅 비율) 지급.

따라서 **2월 10일 00:01 KST 이후** 당첨자 잔액과 `payout_history`로 정산 여부 확인 가능.

## 4. CMD에서 백필 호출 시 참고 (Windows)

괄호·따옴표 이스케이프 문제로 curl이 실패할 수 있음. 아래처럼 JSON을 파일로 두고 호출하는 방식을 권장.

```cmd
echo {"poll_dates":["2026-02-06","2026-02-07"]} > body.json
curl -X POST "http://localhost:3000/api/cron/btc-ohlc-backfill" -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" -d @body.json
```

URL은 반드시 따옴표 없이 그냥 입력 (대괄호가 URL에 들어가면 안 됨).

## 5. Cron 자동 실행 여부

- **Vercel Cron**은 서버가 스케줄에 따라 **자동으로** GET 요청을 보냅니다.
- 사용자가 사이트에 접속할 필요 없음.
- `vercel.json`의 `crons`와 Vercel 대시보드에 등록된 프로젝트만 해당하며, **Production 배포**가 되어 있어야 합니다.

## 6. 2월 6일·7일 OHLC가 안 채워졌을 수 있는 이유

- Cron이 그때는 아직 설정되지 않았거나, 해당일 00:01 KST에 실행되지 않았을 수 있음.
- Binance API 일시 오류/타임아웃으로 OHLC 조회 실패 후, 당시에는 미정산 재시도 로직이 없어서 그날만 놓쳤을 수 있음.
- 현재는 **미정산 과거 폴(최근 7일) 재시도**가 cron에 포함되어 있어, 다음날 cron 실행 시 2월 6일·7일 같은 미정산 폴이 있으면 자동으로 정산 재시도됨 (단, OHLC는 백필로 먼저 채워져 있어야 함).

과거 구간은 **백필 API**로 해당 `poll_dates`의 시가·종가를 채운 뒤,  
- 같은 날짜에 대해 **POST /api/sentiment/settle** body `{"poll_date":"2026-02-06","market":"btc"}` 로 수동 정산하거나,  
- 다음날 00:01 KST cron이 돌 때 **미정산 재시도**로 정산되도록 할 수 있음.
