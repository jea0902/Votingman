# 26년 1월 1일 ~ 26년 2월 13일 btc_1d(일봉) 백필
# 사용: .\scripts\backfill-btc-1d-2026-jan-feb.ps1
# 조건: .env.local에 CRON_SECRET 있음. 로컬이면 npm run dev 실행 중.

$ErrorActionPreference = "Stop"
$envPath = Join-Path (Join-Path $PSScriptRoot "..") ".env.local"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $val, 'Process')
        }
    }
}

$baseUrl = if ($env:VERCEL_URL) { "https://$env:VERCEL_URL" } else { "http://localhost:3000" }
$secret = $env:CRON_SECRET
if (-not $secret) {
    Write-Host "CRON_SECRET이 없습니다. .env.local에 설정하세요."
    exit 1
}

# 2026-01-01 ~ 2026-02-13 날짜 배열
$poll_dates = @()
$start = [DateTime]::Parse("2026-01-01")
$end   = [DateTime]::Parse("2026-02-13")
for ($d = $start; $d -le $end; $d = $d.AddDays(1)) {
    $poll_dates += $d.ToString("yyyy-MM-dd")
}

$body = @{ poll_dates = $poll_dates; markets = @("btc_1d") } | ConvertTo-Json
Write-Host "호출: $baseUrl/api/cron/btc-ohlc-backfill"
Write-Host "일봉 백필: 2026-01-01 ~ 2026-02-13 ($($poll_dates.Count)일)"
$result = Invoke-RestMethod -Uri "$baseUrl/api/cron/btc-ohlc-backfill" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer $secret"; "Content-Type" = "application/json" } `
    -Body $body

if ($result.success) {
    Write-Host "성공. total_upserted: $($result.data.total_upserted)"
} else {
    Write-Host "실패: $($result.error)"
    exit 1
}
