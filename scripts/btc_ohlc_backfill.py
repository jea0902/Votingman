"""
BTC OHLC 백필 스크립트 (ccxt + Binance)

- ccxt로 Binance BTCUSDT 1d, 4h, 1w 캔들 수집
- Rate Limit 준수: 요청 간 1.5초 지연
- 2017-08-18 (Binance BTC 시장 개장일) ~ 현재
- btc_ohlc 테이블에 upsert

실행:
    python scripts/btc_ohlc_backfill.py
    python scripts/btc_ohlc_backfill.py --market btc_4h   # 특정 마켓만
    python scripts/btc_ohlc_backfill.py --dry-run        # DB 저장 없이 테스트
"""

import os
import sys
import time
import argparse
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests
from dotenv import load_dotenv

# 프로젝트 루트 기준 .env.local
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
load_dotenv(dotenv_path=os.path.join(project_root, ".env.local"))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Binance BTC 시장 개장일 2017-08-18 00:00 UTC
BINANCE_BTC_START_MS = 1_502_928_000_000

# Rate Limit: Binance 1200 weight/min, klines ~1 weight → 요청 간 1.5초 지연
REQUEST_DELAY_SEC = 1.5

# ccxt fetch_ohlcv 최대 건수 (Binance 1000)
CANDLES_PER_REQUEST = 1000

# market → ccxt timeframe
MARKET_TO_TIMEFRAME = {
    "btc_1d": "1d",
    "btc_4h": "4h",
    "btc_1W": "1w",
}


def validate_env() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERR: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY required in .env.local")
        sys.exit(1)


BATCH_SIZE = 100  # Supabase 요청당 건수


def upsert_btc_ohlc(rows: list[dict]) -> int:
    """Supabase REST API로 btc_ohlc upsert. 반환: 처리된 건수."""
    if not rows:
        return 0
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/btc_ohlc"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    params = {"on_conflict": "market,candle_start_at"}
    total = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        resp = requests.post(url, json=batch, headers=headers, params=params, timeout=60)
        resp.raise_for_status()
        total += len(batch)
    return total


def utc_to_kst_str(utc_ts_ms: int) -> str:
    """UTC ms → KST ISO 문자열 (YYYY-MM-DD HH:MM:SS)"""
    dt = datetime.fromtimestamp(utc_ts_ms / 1000, tz=timezone.utc)
    kst_dt = dt + timedelta(hours=9)
    return kst_dt.strftime("%Y-%m-%d %H:%M:%S")


def row_to_upsert(market: str, candle: list) -> dict:
    """ccxt OHLCV [ts, o, h, l, c, v] → btc_ohlc 행"""
    ts_ms = int(candle[0])
    open_p = round(float(candle[1]) * 100) / 100
    high_p = round(float(candle[2]) * 100) / 100 if candle[2] else open_p
    low_p = round(float(candle[3]) * 100) / 100 if candle[3] else open_p
    close_p = round(float(candle[4]) * 100) / 100

    candle_start_at = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat()
    candle_start_at_kst = utc_to_kst_str(ts_ms)

    return {
        "market": market,
        "candle_start_at": candle_start_at,
        "candle_start_at_kst": candle_start_at_kst,
        "open": open_p,
        "close": close_p,
        "high": high_p,
        "low": low_p,
    }


def backfill_market(
    market: str,
    dry_run: bool = False,
    limit_requests: Optional[int] = None,
) -> tuple[int, int]:
    """
    단일 마켓 백필
    Returns: (저장 건수, 에러 건수)
    """
    import ccxt

    timeframe = MARKET_TO_TIMEFRAME.get(market)
    if not timeframe:
        raise ValueError(f"지원 market: {list(MARKET_TO_TIMEFRAME.keys())}")

    exchange = ccxt.binance({
        "enableRateLimit": True,
        "options": {"defaultType": "spot"},
    })

    symbol = "BTC/USDT"
    since = BINANCE_BTC_START_MS
    total_inserted = 0
    total_errors = 0
    request_count = 0

    print(f"\n[{market}] ({timeframe}) backfill...")

    while True:
        if limit_requests is not None and request_count >= limit_requests:
            print(f"   [LIMIT] Stopped at {request_count} requests")
            break
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=CANDLES_PER_REQUEST)
        request_count += 1
        time.sleep(REQUEST_DELAY_SEC)

        if not ohlcv:
            break

        rows = [row_to_upsert(market, c) for c in ohlcv]
        since = int(ohlcv[-1][0]) + 1  # 다음 페이지

        if dry_run:
            print(f"   [DRY-RUN] {len(rows)} rows (last: {rows[-1]['candle_start_at']})")
            total_inserted += len(rows)
        else:
            try:
                upsert_btc_ohlc(rows)
                total_inserted += len(rows)
                print(f"   OK {len(rows)} rows upserted (total: {total_inserted})")
            except Exception as e:
                total_errors += len(rows)
                print(f"   ERR upsert failed: {e}")

        if len(ohlcv) < CANDLES_PER_REQUEST:
            break

    return total_inserted, total_errors


def main() -> None:
    parser = argparse.ArgumentParser(description="BTC OHLC 백필 (ccxt + Binance)")
    parser.add_argument(
        "--market",
        choices=list(MARKET_TO_TIMEFRAME.keys()),
        default=None,
        help="특정 마켓만 백필 (기본: 1d, 4h, 1W 모두)",
    )
    parser.add_argument("--dry-run", action="store_true", help="DB save skip (test only)")
    parser.add_argument("--limit", type=int, default=None, help="Max API requests per market (for testing)")
    args = parser.parse_args()

    validate_env()

    markets = [args.market] if args.market else list(MARKET_TO_TIMEFRAME.keys())
    print(f"[START] BTC OHLC backfill (markets={markets}, dry_run={args.dry_run})")

    total = 0
    for m in markets:
        inserted, errs = backfill_market(m, dry_run=args.dry_run, limit_requests=args.limit)
        total += inserted

    print(f"\n[DONE] Total {total} rows saved")


if __name__ == "__main__":
    main()
