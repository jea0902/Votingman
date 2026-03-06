@echo off
REM =============================================
REM 긴급 복구 배치 파일 (Windows)
REM =============================================

set CRON_SECRET=9nysIzkyOPR3WkhAmyelqF6RjAR9MXAn5AvCxITzW5Y=
set DOMAIN=https://www.votingman.com

echo 🚨 긴급 캔들 복구 시작...

echo 📊 15분봉 복구...
curl -H "x-cron-secret: %CRON_SECRET%" "%DOMAIN%/api/cron/btc-ohlc-15m"
echo.

echo 📊 1시간봉 복구...  
curl -H "x-cron-secret: %CRON_SECRET%" "%DOMAIN%/api/cron/btc-ohlc-1h"
echo.

echo 📊 4시간봉 복구...
curl -H "x-cron-secret: %CRON_SECRET%" "%DOMAIN%/api/cron/btc-ohlc-4h"  
echo.

echo 📊 1일봉 복구...
curl -H "x-cron-secret: %CRON_SECRET%" "%DOMAIN%/api/cron/btc-ohlc-daily"
echo.

echo 📋 복구 후 상태 확인...
curl "%DOMAIN%/api/monitor/cron-health"

echo.
echo ✅ 긴급 복구 완료!
pause