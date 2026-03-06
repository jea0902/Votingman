@echo off
REM =============================================
REM 4시간봉 과거 데이터 백필
REM =============================================

set CRON_SECRET=9nysIzkyOPR3WkhAmyelqF6RjAR9MXAn5AvCxITzW5Y=
set DOMAIN=https://www.votingman.com

echo 🔥 4시간봉 과거 데이터 백필 시작...

REM 최근 7일치 데이터 수집
echo 📊 최근 7일치 4시간봉 수집...
curl -X POST -H "x-cron-secret: %CRON_SECRET%" -H "Content-Type: application/json" ^
  -d "{\"poll_dates\":[\"2026-02-27\",\"2026-02-28\",\"2026-03-01\",\"2026-03-02\",\"2026-03-03\",\"2026-03-04\",\"2026-03-05\"],\"markets\":[\"btc_4h\"]}" ^
  "%DOMAIN%/api/cron/btc-ohlc-backfill"

echo.
echo 📋 백필 완료!
echo 이제 DB에서 4시간봉이 많이 늘었는지 확인해보세요.
pause