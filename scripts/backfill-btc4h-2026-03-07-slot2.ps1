# 3월 7일 KST 12시 마감(08~12시) btc_4h 봉 1개 백필
# Cursor 터미널(PowerShell)에서: .\scripts\backfill-btc4h-2026-03-07-slot2.ps1
# CRON_SECRET은 환경변수 또는 아래 $secret 에 직접 넣기

$secret = $env:CRON_SECRET
if (-not $secret) { $secret = "여기에_CRON_SECRET_넣기" }

$body = @{
  poll_dates = @("2026-03-07")
  markets    = @("btc_4h")
  btc_4h_slots = @(2)
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://www.votingman.com/api/cron/btc-ohlc-backfill" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "x-cron-secret" = $secret
  } `
  -Body $body
