import os
import time
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv

"""
KOSPI/KOSDAQ OHLC 백필 스크립트 (Yahoo Finance → korea_ohlc)

- BTC 백필 스크립트(btc_ohlc_backfill.py)와 동일하게:
  - 프로젝트 루트의 .env.local 을 읽어서 SUPABASE_URL / SERVICE_ROLE_KEY 사용
  - Supabase REST API로 korea_ohlc 에 upsert
  - 터미널에서 단순히 `python scripts/korea-ohlc-backfill.py` 로 실행 가능
"""

# 프로젝트 루트 기준 .env.local 로드
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
load_dotenv(dotenv_path=os.path.join(project_root, ".env.local"))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart"

# 1d 일봉 + 1h 인트라데이 (1h: 2020~오늘, Yahoo 1h는 요청당 약 60일만 반환되므로 60일 단위 청크)
MARKETS = [
    {"market": "kospi_1d", "symbol": "^KS11", "interval": "1d"},
    {"market": "kosdaq_1d", "symbol": "^KQ11", "interval": "1d"},
    {"market": "kospi_1h", "symbol": "^KS11", "interval": "1h"},
    {"market": "kosdaq_1h", "symbol": "^KQ11", "interval": "1h"},
]


def validate_env() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 설정되어 있어야 합니다."
        )


KST_OFFSET_SEC = 9 * 60 * 60


def is_trading_day_kst_from_utc(utc_ts: float) -> bool:
    """UTC timestamp(초 기준)를 받아 KST 기준 거래일(영업일)인지 판단.
    - 주말(토/일) 제외
    - 2026년 휴장일은 korea-market-holidays.json 기준으로 제외
    """
    # UTC → KST
    kst_dt = datetime.fromtimestamp(utc_ts + KST_OFFSET_SEC, tz=timezone.utc)
    # 주말 제외
    if kst_dt.weekday() >= 5:  # 5=토, 6=일
        return False
    ymd = kst_dt.date().isoformat()
    # 2026년 휴장일 목록
    holidays_2026 = {
        "2026-01-01",
        "2026-02-16",
        "2026-02-17",
        "2026-02-18",
        "2026-03-01",
        "2026-03-02",
        "2026-05-01",
        "2026-05-05",
        "2026-05-24",
        "2026-05-25",
        "2026-06-03",
        "2026-06-06",
        "2026-07-17",
        "2026-08-15",
        "2026-08-17",
        "2026-09-24",
        "2026-09-25",
        "2026-09-26",
        "2026-10-03",
        "2026-10-05",
        "2026-10-09",
        "2026-12-25",
        "2026-12-31",
    }
    if ymd.startswith("2026-") and ymd in holidays_2026:
        return False
    return True


def fetch_index(symbol: str, interval: str, period1: datetime, period2: datetime):
    """Yahoo Finance에서 특정 지수(symbol)의 1d/1h 봉을 period1~period2 구간으로 조회"""
    p1 = int(period1.replace(tzinfo=timezone.utc).timestamp())
    p2 = int(period2.replace(tzinfo=timezone.utc).timestamp())

    params = {
        "interval": interval,
        "period1": str(p1),
        "period2": str(p2),
    }
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
            # 날짜 기준으로 UTC 00:00 고정
            date_str = dt.date().isoformat()
            candle_start_at = datetime.strptime(date_str, "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
            # 휴장일/주말 필터: KST 기준 거래일이 아닌 날은 스킵
            if not is_trading_day_kst_from_utc(candle_start_at.timestamp()):
                continue
        else:
            # 1시간봉: 해당 시각의 정각 UTC
            candle_start_at = dt.replace(
                minute=0, second=0, microsecond=0, tzinfo=timezone.utc
            )

        rows.append(
            (
                candle_start_at.isoformat().replace("+00:00", "Z"),
                float(o if o is not None else c),
                float(h if h is not None else c),
                float(l if l is not None else c),
                float(c),
            )
        )
    return rows


def utc_iso_to_kst_string(utc_iso: str) -> str:
    """UTC ISO 시각을 KST 'YYYY-MM-DD HH:mm:ss'로 변환 (DB candle_start_at_kst / updated_at 형식)."""
    dt = datetime.fromisoformat(utc_iso.replace("Z", "+00:00"))
    kst_ts = dt.timestamp() + KST_OFFSET_SEC
    kst_dt = datetime.fromtimestamp(kst_ts, tz=timezone.utc)
    return kst_dt.strftime("%Y-%m-%d %H:%M:%S")


def upsert_korea_ohlc(market: str, rows):
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


def backfill_market(
    market_id: str, symbol: str, interval: str, start: datetime, end: datetime
):
    """특정 market에 대해 start~end 구간을 chunk 단위로 백필. 1h는 Yahoo 한계로 60일 청크."""
    chunk_days = 60 if interval == "1h" else 365
    cur_start = start
    while cur_start < end:
        cur_end = min(cur_start + timedelta(days=chunk_days), end)
        print(f"[{market_id}] fetch {interval} {cur_start.date()} ~ {cur_end.date()} ...")
        rows = fetch_index(symbol, interval, cur_start, cur_end)
        print(f"[{market_id}]  got {len(rows)} rows, upserting...")
        inserted = upsert_korea_ohlc(market_id, rows)
        print(f"[{market_id}]  upserted {inserted} rows")
        time.sleep(1.0)  # 야후/네트워크 부담 줄이기
        cur_start = cur_end


def main():
    validate_env()

    today = datetime.now(timezone.utc)
    for m in MARKETS:
        if m["interval"] == "1d":
            start = datetime(2000, 1, 1, tzinfo=timezone.utc)
            end = today
        else:
            # 1시간봉: Yahoo는 오래된 구간에 422 반환 → 최근 60일만 요청
            start = today - timedelta(days=60)
            end = today

        backfill_market(
            m["market"],
            m["symbol"],
            m["interval"],
            start,
            end,
        )


if __name__ == "__main__":
    main()

