@echo off
REM =============================================
REM 4시간봉 대량 수집 (API 직접 호출)
REM =============================================

set CRON_SECRET=9nysIzkyOPR3WkhAmyelqF6RjAR9MXAn5AvCxITzW5Y=
set DOMAIN=https://www.votingman.com

echo 🔥 4시간봉 대량 데이터 수집 시작...

REM 백필 API 사용해서 과거 데이터 수집
echo 📊 백필 API로 과거 4시간봉 수집...
curl -H "x-cron-secret: %CRON_SECRET%" "%DOMAIN%/api/cron/btc-ohlc-backfill"

echo.
echo 📋 대량 수집 완료!
echo 이제 DB에서 4시간봉이 많이 늘었는지 확인해보세요.
pause