# btc_ohlc 백필 API 수동 테스트
# 사용: .\scripts\test-btc-ohlc-backfill.ps1
# 조건: npm run dev 실행 중, .env.local에 CRON_SECRET 있음

# .env.local 로드
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

$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$body = @{ poll_dates = @($yesterday) } | ConvertTo-Json

Write-Host "호출: $baseUrl/api/cron/btc-ohlc-backfill"
Write-Host "날짜: $yesterday"
$result = Invoke-RestMethod -Uri "$baseUrl/api/cron/btc-ohlc-backfill" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer $secret"; "Content-Type" = "application/json" } `
    -Body $body

$result | ConvertTo-Json -Depth 5
if ($result.success) {
    Write-Host "`n성공. total_upserted: $($result.data.total_upserted)"
} else {
    Write-Host "`n실패: $($result.error)"
    exit 1
}
