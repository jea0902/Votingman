#!/bin/bash
# =============================================
# 긴급 복구 스크립트
# =============================================

CRON_SECRET="9nysIzkyOPR3WkhAmyelqF6RjAR9MXAn5AvCxITzW5Y="
DOMAIN="https://www.votingman.com"

echo "🚨 긴급 캔들 복구 시작..."

# 1. 모든 캔들 수동 수집 (누락분 복구)
echo "📊 15분봉 복구..."
curl -s -H "x-cron-secret: $CRON_SECRET" "$DOMAIN/api/cron/btc-ohlc-15m" | jq '.data.message, .data.total_fetched'

echo "📊 1시간봉 복구..."
curl -s -H "x-cron-secret: $CRON_SECRET" "$DOMAIN/api/cron/btc-ohlc-1h" | jq '.data.message, .data.total_fetched'

echo "📊 4시간봉 복구..."  
curl -s -H "x-cron-secret: $CRON_SECRET" "$DOMAIN/api/cron/btc-ohlc-4h" | jq '.data.message, .data.total_fetched'

echo "📊 1일봉 복구..."
curl -s -H "x-cron-secret: $CRON_SECRET" "$DOMAIN/api/cron/btc-ohlc-daily" | jq '.data.message'

# 2. 상태 확인
echo "📋 복구 후 상태 확인..."
curl -s "$DOMAIN/api/monitor/cron-health" | jq '.data.markets[] | {market: .market, missing: .missing_candles, status: .status}'

echo "✅ 긴급 복구 완료!"