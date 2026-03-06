@echo off
REM =============================================
REM 4시간봉 데이터 재구축 (Windows)
REM =============================================

set CRON_SECRET=9nysIzkyOPR3WkhAmyelqF6RjAR9MXAn5AvCxITzW5Y=
set DOMAIN=https://www.votingman.com

echo 🔥 4시간봉 데이터 재구축 시작...

echo 📊 4시간봉 강제 수집 (20회 반복)...
for /L %%i in (1,1,20) do (
    echo %%i번째 수집 시도...
    curl -H "x-cron-secret: %CRON_SECRET%" "%DOMAIN%/api/cron/btc-ohlc-4h"
    echo.
    timeout /t 2 >nul
)

echo 📋 재구축 완료!
echo 이제 DB에서 4시간봉 패턴을 다시 확인해보세요.
pause