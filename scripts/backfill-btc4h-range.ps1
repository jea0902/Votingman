# btc_4h 전체 구간 백필 (2017-08-18 ~ 2026-03-07 12:00 KST)
# KST 00/04/08/12/16/20 시 기준, candle_start_at은 UTC로 저장됨
# 사용: $env:CRON_SECRET = "비밀"; .\scripts\backfill-btc4h-range.ps1

$secret = $env:CRON_SECRET
if (-not $secret) { Write-Error "CRON_SECRET 필요"; exit 1 }

$base = "https://www.votingman.com"
$body = @{
  btc_4h_range = @{
    start_date     = "2017-08-18"
    end_date       = "2026-03-07"
    end_date_slot  = 2
    batch_size     = 100
  }
} | ConvertTo-Json -Depth 5

$total = 0
do {
  $r = Invoke-RestMethod -Uri "$base/api/cron/btc-ohlc-backfill" -Method POST `
    -Headers @{ "Content-Type" = "application/json"; "x-cron-secret" = $secret } -Body $body
  if (-not $r.success) { Write-Host $r; exit 1 }
  $total += $r.data.total_upserted
  Write-Host "이번 배치: $($r.data.total_upserted)건, 누적: $total, done: $($r.data.done)"
  if ($r.data.done) { break }
  $body = @{ btc_4h_range = @{
    start_date     = "2017-08-18"
    end_date       = "2026-03-07"
    end_date_slot  = 2
    batch_size     = 100
    cursor         = $r.data.next_cursor
  } } | ConvertTo-Json -Depth 5
} while ($true)
Write-Host "완료. 총 $total 건"
