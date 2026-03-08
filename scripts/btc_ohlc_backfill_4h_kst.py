"""
BTC 4시간봉 백필 (KST 기준: 00/04/08/12/16/20 시)

- 크론/앱과 동일: KST 00, 04, 08, 12, 16, 20 시 시작 봉
- Binance 4h는 UTC 정렬이라 사용 안 함 → 1h 봉 4개 조회 후 집계
- candle_start_at: UTC ISO (저장/조회용), candle_start_at_kst: KST 문자열
- 2017-08-18 (Binance 개장 다음날) ~ 지정 end_date 12:00 KST까지

실행:
    python scripts/btc_ohlc_backfill_4h_kst.py
    python scripts/btc_ohlc_backfill_4h_kst.py --end-date 2026-03-07 --dry-run
    python scripts/btc_ohlc_backfill_4h_kst.py --batch 100
"""

import os
import sys
import time
import argparse
from datetime import datetime, timezone, timedelta

import requests
from dotenv import load_dotenv

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
load_dotenv(dotenv_path=os.path.join(project_root, ".env.local"))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

BINANCE_BTC_START_DATE = "2017-08-18"  # KST 날짜
# 1h 봉 1000개씩 한 번에 조회 후 KST 4h로 집계 → 호출 수 ~1/250
OHLCV_1H_CHUNK = 1000
REQUEST_DELAY_SEC = 1.2  # 1000건 조회 후 대기 (원본 스크립트와 비슷)
BATCH_SIZE = 100


def validate_env() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERR: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY required in .env.local")
        sys.exit(1)


# KST = UTC+9
KST = timezone(timedelta(hours=9))


def kst_slot_to_utc_ts_ms(date_str: str, slot: int) -> int:
    """KST 날짜 + 슬롯(0~5) → 해당 봉 시작 시각 UTC (ms). slot 0=00시, 1=04시, ..., 5=20시 KST."""
    y, m, d = map(int, date_str.split("-"))
    hour_kst = slot * 4
    dt_kst = datetime(y, m, d, hour_kst, 0, 0, tzinfo=KST)
    dt_utc = dt_kst.astimezone(timezone.utc)
    return int(dt_utc.timestamp() * 1000)


def kst_slot_to_kst_str(date_str: str, slot: int) -> str:
    """KST 날짜 + 슬롯 → candle_start_at_kst 문자열 (YYYY-MM-DD HH:00:00)."""
    y, m, d = map(int, date_str.split("-"))
    h = slot * 4
    return f"{y:04d}-{m:02d}-{d:02d} {h:02d}:00:00"


def utc_ts_ms_to_iso(ts_ms: int) -> str:
    """UTC ms → ISO 문자열 (candle_start_at 저장용)."""
    return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def upsert_btc_ohlc(rows: list[dict]) -> int:
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


def ts_ms_to_kst_date_slot(ts_ms: int) -> tuple[str, int]:
    """UTC ms → (KST 날짜 YYYY-MM-DD, 슬롯 0~5)."""
    dt_utc = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    dt_kst = dt_utc.astimezone(KST)
    date_str = dt_kst.strftime("%Y-%m-%d")
    hour = dt_kst.hour
    slot = hour // 4
    if slot > 5:
        slot = 5
    return date_str, slot


def aggregate_1h_to_4h_kst_rows(ohlcv_1h: list) -> list[dict]:
    """1h 봉 리스트를 KST 4h 슬롯별로 묶어 집계. 완전한 4개만 있는 슬롯만 반환."""
    from collections import defaultdict
    groups: dict[tuple[str, int], list] = defaultdict(list)
    for c in ohlcv_1h:
        ts_ms = int(c[0])
        date_str, slot = ts_ms_to_kst_date_slot(ts_ms)
        groups[(date_str, slot)].append(c)
    rows = []
    for (date_str, slot), candles in sorted(groups.items()):
        if len(candles) != 4:
            continue
        candles.sort(key=lambda x: x[0])
        o = round(float(candles[0][1]) * 100) / 100
        h = round(max(float(c[2]) for c in candles) * 100) / 100
        l = round(min(float(c[3]) for c in candles) * 100) / 100
        cl = round(float(candles[3][4]) * 100) / 100
        start_ms = kst_slot_to_utc_ts_ms(date_str, slot)
        rows.append({
            "market": "btc_4h",
            "candle_start_at": utc_ts_ms_to_iso(start_ms),
            "candle_start_at_kst": kst_slot_to_kst_str(date_str, slot),
            "open": o,
            "high": h,
            "low": l,
            "close": cl,
        })
    return rows


def run_backfill(
    end_date: str,
    dry_run: bool = False,
    batch: int = 100,
) -> int:
    import ccxt

    exchange = ccxt.binance({
        "enableRateLimit": True,
        "options": {"defaultType": "spot"},
    })

    end_utc_ms = kst_slot_to_utc_ts_ms(end_date, 3)  # 12:00 KST = slot 3 시작 직전
    since_ms = kst_slot_to_utc_ts_ms(BINANCE_BTC_START_DATE, 0)
    total = 0
    rows: list[dict] = []
    request_count = 0

    while since_ms < end_utc_ms:
        ohlcv = exchange.fetch_ohlcv("BTC/USDT", "1h", since=since_ms, limit=OHLCV_1H_CHUNK)
        request_count += 1
        time.sleep(REQUEST_DELAY_SEC)
        if not ohlcv:
            break
        chunk_rows = aggregate_1h_to_4h_kst_rows(ohlcv)
        for r in chunk_rows:
            ts_ms = int(datetime.fromisoformat(r["candle_start_at"].replace("Z", "+00:00")).timestamp() * 1000)
            if ts_ms < end_utc_ms:
                rows.append(r)
        print(f"   요청 {request_count}: 1h {len(ohlcv)}건 → 4h {len(chunk_rows)}건 (버퍼 {len(rows)}, 누적 upsert {total})", flush=True)
        while len(rows) >= batch:
            to_upsert = rows[:batch]
            rows = rows[batch:]
            if not dry_run:
                upsert_btc_ohlc(to_upsert)
            total += len(to_upsert)
            print(f"   upsert {len(to_upsert)}건 (누적 {total})", flush=True)
        since_ms = int(ohlcv[-1][0]) + 3600 * 1000
        if len(ohlcv) < OHLCV_1H_CHUNK:
            break

    if rows:
        if not dry_run:
            upsert_btc_ohlc(rows)
        total += len(rows)
        print(f"   final upsert {len(rows)}건 (총 {total})", flush=True)

    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="BTC 4h 백필 (KST 00/04/08/12/16/20)")
    parser.add_argument("--end-date", default="2026-03-07", help="마지막 날 YYYY-MM-DD (해당일 12:00 KST까지)")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 안 함")
    parser.add_argument("--batch", type=int, default=100, help="몇 건마다 upsert (기본 100)")
    args = parser.parse_args()

    validate_env()
    print(f"[START] btc_4h KST backfill (end={args.end_date}, dry_run={args.dry_run})")
    total = run_backfill(args.end_date, dry_run=args.dry_run, batch=args.batch)
    print(f"[DONE] Total {total} rows")


if __name__ == "__main__":
    main()
