@echo off
REM =============================================
REM 4시간봉 간단 백필 (개별 날짜)
REM =============================================

set CRON_SECRET=9nysIzkyOPR3WkhAmyelqF6RjAR9MXAn5AvCxITzW5Y=
set DOMAIN=https://www.votingman.com

echo 🔥 4시간봉 간단 백필 시작...

echo 📊 2026-03-04 수집...
curl -X POST -H "x-cron-secret: %CRON_SECRET%" -H "Content-Type: application/json" -d "{\"poll_dates\":[\"2026-03-04\"],\"markets\":[\"btc_4h\"]}" "%DOMAIN%/api/cron/btc-ohlc-backfill"
echo.

echo 📊 2026-03-03 수집...  
curl -X POST -H "x-cron-secret: %CRON_SECRET%" -H "Content-Type: application/json" -d "{\"poll_dates\":[\"2026-03-03\"],\"markets\":[\"btc_4h\"]}" "%DOMAIN%/api/cron/btc-ohlc-backfill"
echo.

echo 📊 2026-03-02 수집...
curl -X POST -H "x-cron-secret: %CRON_SECRET%" -H "Content-Type: application/json" -d "{\"poll_dates\":[\"2026-03-02\"],\"markets\":[\"btc_4h\"]}" "%DOMAIN%/api/cron/btc-ohlc-backfill"
echo.

echo 📊 2026-03-01 수집...
curl -X POST -H "x-cron-secret: %CRON_SECRET%" -H "Content-Type: application/json" -d "{\"poll_dates\":[\"2026-03-01\"],\"markets\":[\"btc_4h\"]}" "%DOMAIN%/api/cron/btc-ohlc-backfill"
echo.

echo 📋 간단 백필 완료!
pause