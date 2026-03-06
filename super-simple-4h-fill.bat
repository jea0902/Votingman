@echo off
REM =============================================
REM 4시간봉 초간단 채우기 (크론 연속 실행)
REM =============================================

set CRON_SECRET=9nysIzkyOPR3WkhAmyelqF6RjAR9MXAn5AvCxITzW5Y=
set DOMAIN=https://www.votingman.com

echo 🔥 4시간봉 초간단 채우기 시작...
echo ⚡ 크론을 50회 연속 실행하여 과거 데이터 수집...

for /L %%i in (1,1,50) do (
    echo %%i번째 수집...
    curl -s -H "x-cron-secret: %CRON_SECRET%" "%DOMAIN%/api/cron/btc-ohlc-4h"
    timeout /t 1 >nul
)

echo.
echo 📋 초간단 채우기 완료!
echo 이제 DB 확인해보세요!
pause