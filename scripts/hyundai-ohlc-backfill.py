"""
현대자동차(005380.KS) OHLC 백필 스크립트 (Yahoo Finance → korea_ohlc)

- korea-ohlc-backfill.py와 동일한 방식:
  - .env.local 의 SUPABASE_URL / SERVICE_ROLE_KEY 사용
  - Supabase REST API로 korea_ohlc upsert
  - 1일봉: 휴장일/주말 필터 적용
  - 실행: python scripts/hyundai-ohlc-backfill.py
"""

import os
import time
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
load_dotenv(dotenv_path=os.path.join(project_root, ".env.local"))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart"

SYMBOL = "005380.KS"
# 1h: 2020~오늘, Yahoo 1h는 요청당 약 60일만 반환되므로 60일 단위 청크
MARKETS = [
    {"market": "hyundai_1d", "symbol": SYMBOL, "interval": "1d"},
    {"market": "hyundai_1h", "symbol": SYMBOL, "interval": "1h"},
]


def validate_env() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 설정되어 있어야 합니다."
        )


KST_OFFSET_SEC = 9 * 60 * 60


def is_trading_day_kst_from_utc(utc_ts: float) -> bool:
    """KST 기준 거래일(영업일)인지 판단. 주말 + 2026 휴장일 제외."""
    kst_dt = datetime.fromtimestamp(utc_ts + KST_OFFSET_SEC, tz=timezone.utc)
    if kst_dt.weekday() >= 5:
        return False
    ymd = kst_dt.date().isoformat()
    holidays_2026 = {
        "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18",
        "2026-03-01", "2026-03-02", "2026-05-01", "2026-05-05",
        "2026-05-24", "2026-05-25", "2026-06-03", "2026-06-06",
        "2026-07-17", "2026-08-15", "2026-08-17", "2026-09-24",
        "2026-09-25", "2026-09-26", "2026-10-03", "2026-10-05",
        "2026-10-09", "2026-12-25", "2026-12-31",
    }
    if ymd.startswith("2026-") and ymd in holidays_2026:
        return False
    return True


def fetch_yahoo(symbol: str, interval: str, period1: datetime, period2: datetime):
    """Yahoo Chart API로 OHLC 조회"""
    p1 = int(period1.replace(tzinfo=timezone.utc).timestamp())
    p2 = int(period2.replace(tzinfo=timezone.utc).timestamp())
    params = {"interval": interval, "period1": str(p1), "period2": str(p2)}
    res = requests.get(
        f"{YAHOO_URL}/{symbol}",
        params=params,
        headers={"User-Agent": "Votingman-backfill/1.0"},
        timeout=10,
    )
    res.raise_for_status()
    data = res.json()
    result = data["chart"]["result"][0]
    ts = result["timestamp"]
    quote = result["indicators"]["quote"][0]
    opens = quote["open"]
    highs = quote["high"]
    lows = quote["low"]
    closes = quote["close"]

    rows: list[tuple[str, float, float, float, float]] = []
    for t, o, h, l, c in zip(ts, opens, highs, lows, closes):
        if c is None:
            continue
        dt = datetime.fromtimestamp(t, tz=timezone.utc)
        if interval == "1d":
            date_str = dt.date().isoformat()
            candle_start_at = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if not is_trading_day_kst_from_utc(candle_start_at.timestamp()):
                continue
        else:
            candle_start_at = dt.replace(minute=0, second=0, microsecond=0, tzinfo=timezone.utc)

        rows.append((
            candle_start_at.isoformat().replace("+00:00", "Z"),
            float(o if o is not None else c),
            float(h if h is not None else c),
            float(l if l is not None else c),
            float(c),
        ))
    return rows


def utc_iso_to_kst_string(utc_iso: str) -> str:
    """UTC ISO 시각을 KST 'YYYY-MM-DD HH:mm:ss'로 변환 (DB candle_start_at_kst / updated_at 형식)."""
    dt = datetime.fromisoformat(utc_iso.replace("Z", "+00:00"))
    kst_ts = dt.timestamp() + KST_OFFSET_SEC
    kst_dt = datetime.fromtimestamp(kst_ts, tz=timezone.utc)
    return kst_dt.strftime("%Y-%m-%d %H:%M:%S")


def upsert_korea_ohlc(market: str, rows) -> int:
    """korea_ohlc upsert (앱과 동일하게 candle_start_at_kst, updated_at 포함). (market, candle_start_at) 중복 제거."""
    if not rows:
        return 0
    seen: dict[str, tuple[float, float, float, float]] = {}
    for (cs, o, h, l, c) in rows:
        seen[cs] = (o, h, l, c)
    unique_rows = [(cs, o, h, l, c) for cs, (o, h, l, c) in seen.items()]

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/korea_ohlc"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    params = {"on_conflict": "market,candle_start_at"}
    now_kst = utc_iso_to_kst_string(datetime.now(timezone.utc).isoformat())
    payload = [
        {
            "market": market,
            "candle_start_at": cs,
            "candle_start_at_kst": utc_iso_to_kst_string(cs.replace("Z", "+00:00")),
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "updated_at": now_kst,
        }
        for (cs, o, h, l, c) in unique_rows
    ]
    resp = requests.post(url, json=payload, headers=headers, params=params, timeout=60)
    if not resp.ok:
        print(f"[ERROR] Supabase responded {resp.status_code}: {resp.text}")
        resp.raise_for_status()
    return len(payload)


def backfill_market(market_id: str, symbol: str, interval: str, start: datetime, end: datetime):
    chunk_days = 60 if interval == "1h" else 365
    cur_start = start
    while cur_start < end:
        cur_end = min(cur_start + timedelta(days=chunk_days), end)
        print(f"[{market_id}] fetch {interval} {cur_start.date()} ~ {cur_end.date()} ...")
        rows = fetch_yahoo(symbol, interval, cur_start, cur_end)
        print(f"[{market_id}]  got {len(rows)} rows, upserting...")
        inserted = upsert_korea_ohlc(market_id, rows)
        print(f"[{market_id}]  upserted {inserted} rows")
        time.sleep(1.0)
        cur_start = cur_end


def main():
    validate_env()
    today = datetime.now(timezone.utc)
    for m in MARKETS:
        if m["interval"] == "1d":
            start = datetime(2000, 1, 1, tzinfo=timezone.utc)
            end = today
        else:
            # 1h: Yahoo는 오래된 구간에 422 반환 → 최근 60일만 요청
            start = today - timedelta(days=60)
            end = today
        backfill_market(m["market"], m["symbol"], m["interval"], start, end)


if __name__ == "__main__":
    main()
