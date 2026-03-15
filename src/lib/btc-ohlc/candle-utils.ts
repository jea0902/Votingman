/**
 * 캔들 시각 유틸
 *
 * 시장별 타임존·크론 (정리):
 * - btc_1d: 타임존 Asia/Seoul. 매일 KST 09:00에 cron 실행. DB btc_ohlc 형식 수집.
 * - btc_4h: 타임존 UTC. every 4 hours. DB btc_ohlc 형식 수집.
 * - btc_1h: 타임존 Asia/Seoul. every 1 hour. DB btc_ohlc 형식 수집.
 * - btc_15m: 타임존 Asia/Seoul. every 15 minutes. DB btc_ohlc 형식 수집.
 * - btc_5m: 타임존 Asia/Seoul. every 5 minutes. DB btc_ohlc 형식 수집.
 *
 * 캔들 정렬: btc_4h만 UTC(00/04/08/12/16/20). 그 외 1d/1h/15m/5m은 KST 기준.
 * DB·정산 비교용 candle_start_at은 UTC ISO로 저장.
 */

import { getTodayUtcDateString } from "@/lib/binance/btc-kst";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 시각을 UTC ISO 문자열로 변환 (KST = UTC+9) */
function kstToUtcIso(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
  second = 0
): string {
  const kstMs = Date.UTC(y, m - 1, d, hour, minute, second);
  const utcMs = kstMs - KST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 타임존 없는 시각 문자열을 UTC로 해석해 ISO 문자열로 반환.
 * "2026-03-08 10:30:00" → 10:30 UTC (로컬 해석 시 KST 10:30 = 01:30 UTC로 잘못됨).
 */
export function ensureUtcIsoString(candleStartAt: string): string {
  const s = candleStartAt.trim();
  if (!s) return s;
  if (/Z$|[+-]\d{2}(:?\d{2})?$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toISOString();
  }
  const asUtc = s.replace(" ", "T") + "Z";
  const d = new Date(asUtc);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

/**
 * candle_start_at 표준 형식 (크론이 넘기는 형식과 동일).
 * 모든 저장·조회 시 이 형식으로 통일 → 폴/OHLC 못 찾는 문제 방지.
 * 반환: "2026-03-08T01:30:00.000Z" (UTC ISO)
 */
export function toCanonicalCandleStartAt(s: string): string {
  return ensureUtcIsoString(s);
}

/** poll_date(YYYY-MM-DD) 파싱 */
function parsePollDate(pollDate: string): { y: number; m: number; d: number } {
  if (!POLL_DATE_REGEX.test(pollDate)) {
    throw new Error("poll_date must be YYYY-MM-DD");
  }
  const [y, m, d] = pollDate.split("-").map(Number);
  if (!y || !m || !d) throw new Error("poll_date must be YYYY-MM-DD");
  return { y, m, d };
}

/**
 * poll_date + 시각(시,분)에 해당하는 candle_start_at (UTC ISO) 반환
 */
export function getCandleStartAt(
  pollDate: string,
  hour: number,
  minute: number
): string {
  const { y, m, d } = parsePollDate(pollDate);
  return kstToUtcIso(y, m, d, hour, minute);
}

/**
 * btc_1d: poll_date 00:00 KST 해당 캔들 시작 시각 (ndq/sp500/kospi/kosdaq 등 일봉 기준용)
 */
export function getBtc1dCandleStartAt(pollDate: string): string {
  return getCandleStartAt(pollDate, 0, 0);
}

/**
 * btc_1d 전용: UTC 00:00 기준 캔들 시작 시각 (Binance 1d와 동일 정렬)
 * poll_date는 UTC 기준 YYYY-MM-DD로 전달.
 */
export function getBtc1dCandleStartAtUtc(utcDate: string): string {
  const { y, m, d } = parsePollDate(utcDate);
  const ms = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  return new Date(ms).toISOString();
}

/**
 * btc_4h: poll_date 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 KST (기존 함수)
 * @param slotIndex 0~5 (0=00:00, 1=04:00, ...)
 */
export function getBtc4hCandleStartAt(pollDate: string, slotIndex: number): string {
  const hour = slotIndex * 4;
  if (hour < 0 || hour > 20) throw new Error("slotIndex must be 0-5");
  return getCandleStartAt(pollDate, hour, 0);
}

/**
 * btc_4h: UTC 기준 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 (바이낸스와 동일)
 * @param utcDate UTC 날짜 YYYY-MM-DD
 * @param slotIndex 0~5 (0=00:00, 1=04:00, ...)
 */
export function getBtc4hCandleStartAtUtc(utcDate: string, slotIndex: number): string {
  const hour = slotIndex * 4;
  if (hour < 0 || hour > 20) throw new Error("slotIndex must be 0-5");
  const { y, m, d } = parsePollDate(utcDate);
  const ms = Date.UTC(y, m - 1, d, hour, 0, 0, 0);
  return new Date(ms).toISOString();
}

/**
 * btc_4h: 잘못 저장된 candle_start_at(예: 03:00)을 Binance 4h 경계(00/04/08/12/16/20 UTC)로 보정
 * 백필·정산 시 과거 잘못된 데이터 호환용
 */
export function normalizeBtc4hCandleStartAt(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const h = d.getUTCHours();
  const utcDateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const slot4h = Math.min(5, Math.floor(h / 4));
  return getBtc4hCandleStartAtUtc(utcDateStr, slot4h);
}

/**
 * btc_1h: poll_date HH:00 KST
 * @param hour 0~23
 */
export function getBtc1hCandleStartAt(pollDate: string, hour: number): string {
  if (hour < 0 || hour > 23) throw new Error("hour must be 0-23");
  return getCandleStartAt(pollDate, hour, 0);
}

/**
 * btc_15m: poll_date HH:MM KST (MM은 0,15,30,45)
 * @param hour 0~23
 * @param slotIndex 0~3 (0=:00, 1=:15, 2=:30, 3=:45)
 */
export function getBtc15mCandleStartAt(
  pollDate: string,
  hour: number,
  slotIndex: number
): string {
  if (hour < 0 || hour > 23) throw new Error("hour must be 0-23");
  if (slotIndex < 0 || slotIndex > 3) throw new Error("slotIndex must be 0-3");
  const minute = slotIndex * 15;
  return getCandleStartAt(pollDate, hour, minute);
}

/**
 * btc_15m: 임의 시각을 KST 15분 경계(00,15,30,45)로 내림 후 UTC ISO 반환
 * DB·크론 간 candle_start_at 포맷 차이 시 폴 조회용
 */
export function normalizeBtc15mCandleStartAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const kstMs = d.getTime() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const h = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  const slotMin = Math.floor(min / 15) * 15;
  const utcMs = Date.UTC(y, m - 1, day, h, slotMin, 0, 0) - KST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/**
 * btc_5m: poll_date HH:MM KST (MM은 0,5,10,15,20,25,30,35,40,45,50,55)
 * @param hour 0~23
 * @param slotIndex 0~11 (0=:00, 1=:05, ..., 11=:55)
 */
export function getBtc5mCandleStartAt(
  pollDate: string,
  hour: number,
  slotIndex: number
): string {
  if (hour < 0 || hour > 23) throw new Error("hour must be 0-23");
  if (slotIndex < 0 || slotIndex > 11) throw new Error("slotIndex must be 0-11");
  const minute = slotIndex * 5;
  return getCandleStartAt(pollDate, hour, minute);
}

/**
 * btc_5m: UTC 기준 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 (바이낸스와 동일)
 * @param utcDate UTC 날짜 YYYY-MM-DD
 * @param utcHour 0~23
 * @param slotIndex 0~11 (0=:00, 1=:05, ..., 11=:55)
 */
export function getBtc5mCandleStartAtUtc(
  utcDate: string,
  utcHour: number,
  slotIndex: number
): string {
  if (utcHour < 0 || utcHour > 23) throw new Error("utcHour must be 0-23");
  if (slotIndex < 0 || slotIndex > 11) throw new Error("slotIndex must be 0-11");
  const minute = slotIndex * 5;
  const { y, m, d } = parsePollDate(utcDate);
  const ms = Date.UTC(y, m - 1, d, utcHour, minute, 0, 0);
  return new Date(ms).toISOString();
}

/**
 * poll_date에 해당하는 당일 캔들 candle_start_at 목록 (과거→미래 순)
 * - btc_1d: 1개 (poll_date = UTC YYYY-MM-DD, Binance 1d 정렬)
 * - btc_4h/1h/15m: poll_date = KST
 */
export function getCandlesForPollDate(
  market: string,
  pollDate: string
): string[] {
  const m =
    market === "btc"
      ? "btc_1d"
      : market === "eth"
        ? "eth_1d"
        : market === "usdt"
          ? "usdt_1d"
          : market === "xrp"
            ? "xrp_1d"
            : market;
  const result: string[] = [];

  switch (m) {
    case "btc_1d":
    case "eth_1d":
    case "usdt_1d":
    case "xrp_1d":
      result.push(getBtc1dCandleStartAtUtc(pollDate));
      break;
    case "btc_4h":
    case "eth_4h":
    case "usdt_4h":
    case "xrp_4h":
      for (let i = 0; i < 6; i++) {
        result.push(getBtc4hCandleStartAtUtc(pollDate, i));
      }
      break;
    case "btc_1h":
    case "eth_1h":
    case "usdt_1h":
    case "xrp_1h":
      for (let h = 0; h < 24; h++) {
        result.push(getBtc1hCandleStartAt(pollDate, h));
      }
      break;
    case "btc_15m":
    case "eth_15m":
    case "usdt_15m":
    case "xrp_15m":
      for (let h = 0; h < 24; h++) {
        for (let s = 0; s < 4; s++) {
          result.push(getBtc15mCandleStartAt(pollDate, h, s));
        }
      }
      break;
    case "btc_5m":
    case "eth_5m":
    case "usdt_5m":
    case "xrp_5m":
      for (let h = 0; h < 24; h++) {
        for (let s = 0; s < 12; s++) {
          result.push(getBtc5mCandleStartAt(pollDate, h, s));
        }
      }
      break;
    case "ndq_1d":
    case "sp500_1d":
    case "kospi_1d":
    case "kosdaq_1d":
    case "samsung_1d":
    case "skhynix_1d":
    case "hyundai_1d":
    case "dow_jones_1d":
    case "wti_1d":
    case "xau_1d":
    case "shanghai_1d":
    case "nikkei_1d":
    case "eurostoxx50_1d":
    case "hang_seng_1d":
    case "usd_krw_1d":
    case "jpy_krw_1d":
    case "usd10y_1d":
    case "usd30y_1d":
      result.push(getBtc1dCandleStartAt(pollDate));
      break;
    case "dow_jones_4h":
    case "wti_4h":
    case "xau_4h":
    case "shanghai_4h":
    case "nikkei_4h":
    case "eurostoxx50_4h":
    case "hang_seng_4h":
    case "usd_krw_4h":
    case "jpy_krw_4h":
    case "usd10y_4h":
    case "usd30y_4h":
    case "sp500_4h": {
      for (let s = 0; s < 6; s++) {
        result.push(getBtc4hCandleStartAt(pollDate, s));
      }
      break;
    }
    case "ndq_4h": {
      for (let s = 0; s < 6; s++) {
        result.push(getBtc4hCandleStartAt(pollDate, s));
      }
      break;
    }
    case "kosdaq_4h": {
      for (let s = 0; s < 6; s++) {
        result.push(getBtc4hCandleStartAt(pollDate, s));
      }
      break;
    }
    case "kospi_4h": {
      for (let s = 0; s < 6; s++) {
        result.push(getBtc4hCandleStartAt(pollDate, s));
      }
      break;
    }
    case "kospi_1h":
    case "kosdaq_1h":
    case "samsung_1h":
    case "skhynix_1h":
    case "hyundai_1h": {
      // 10:00~15:00 KST = 01:00~06:00 UTC (당일 결과용)
      const [y, m, d] = pollDate.split("-").map(Number);
      for (let utcHour = 1; utcHour <= 6; utcHour++) {
        result.push(new Date(Date.UTC(y, m - 1, d, utcHour, 0, 0, 0)).toISOString());
      }
      break;
    }
    default:
      return [];
  }

  return result;
}

/** market별 poll_date의 첫 캔들 candle_start_at (btc_1d는 UTC 00:00, 나머지는 KST) */
export function getCandleStartAtForMarket(
  market: string,
  pollDate: string,
  options?: { hour?: number; slot4h?: number; slot15m?: number; slot5m?: number }
): string {
  const m =
    market === "btc" ? "btc_1d" : market === "eth" ? "eth_1d" : market === "usdt" ? "usdt_1d" : market === "xrp" ? "xrp_1d" : market;
  switch (m) {
    case "btc_1d":
    case "eth_1d":
    case "usdt_1d":
    case "xrp_1d":
      return getBtc1dCandleStartAtUtc(pollDate);
    case "btc_4h":
    case "eth_4h":
    case "usdt_4h":
    case "xrp_4h":
      return getBtc4hCandleStartAtUtc(pollDate, options?.slot4h ?? 0);
    case "btc_1h":
    case "eth_1h":
    case "usdt_1h":
    case "xrp_1h":
      return getBtc1hCandleStartAt(pollDate, options?.hour ?? 0);
    case "btc_15m":
    case "eth_15m":
    case "usdt_15m":
    case "xrp_15m":
      return getBtc15mCandleStartAt(
        pollDate,
        options?.hour ?? 0,
        options?.slot15m ?? 0
      );
    case "btc_5m":
    case "eth_5m":
    case "usdt_5m":
    case "xrp_5m":
      return getBtc5mCandleStartAt(
        pollDate,
        options?.hour ?? 0,
        options?.slot5m ?? 0
      );
    default:
      throw new Error(`Unsupported market for candle: ${market}`);
  }
}

const MS_5M = 5 * 60 * 1000;
const MS_15M = 15 * 60 * 1000;
const MS_1H = 60 * 60 * 1000;
const MS_4H = 4 * MS_1H;
const MS_1D = 24 * MS_1H;

/**
 * 최근 N개의 마감된 캔들 candle_start_at 목록 (과거부터 시간순)
 * @param market btc_1d | btc_4h | btc_1h | btc_15m | btc_5m
 * @param count 가져올 캔들 수
 */
export function getRecentCandleStartAts(
  market: string,
  count: number
): string[] {
  const m =
    market === "btc" ? "btc_1d" : market === "eth" ? "eth_1d" : market === "usdt" ? "usdt_1d" : market === "xrp" ? "xrp_1d" : market;
  const now = new Date();
  const kstMs = now.getTime() + KST_OFFSET_MS;

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = (dy: number, dm: number, dd: number) =>
    `${dy}-${pad(dm)}-${pad(dd)}`;

  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    let targetKstMs: number;
    switch (m) {
      case "btc_1d":
      case "eth_1d":
      case "usdt_1d":
      case "xrp_1d":
        targetKstMs = kstMs - (i + 1) * MS_1D;
        break;
      case "btc_4h":
      case "eth_4h":
      case "usdt_4h":
      case "xrp_4h":
        targetKstMs = kstMs - (i + 1) * MS_4H;
        break;
      case "btc_1h":
      case "eth_1h":
      case "usdt_1h":
      case "xrp_1h":
        targetKstMs = kstMs - (i + 1) * MS_1H;
        break;
      case "btc_15m":
      case "eth_15m":
      case "usdt_15m":
      case "xrp_15m":
        targetKstMs = kstMs - (i + 1) * MS_15M;
        break;
      case "btc_5m":
      case "eth_5m":
      case "usdt_5m":
      case "xrp_5m":
        targetKstMs = kstMs - (i + 1) * MS_5M;
        break;
      default:
        return [];
    }

    const kst = new Date(targetKstMs);
    const dy = kst.getUTCFullYear();
    const dm = kst.getUTCMonth() + 1;
    const dd = kst.getUTCDate();
    const hh = kst.getUTCHours();
    const mm = kst.getUTCMinutes();

    switch (m) {
      case "btc_1d":
      case "eth_1d":
      case "usdt_1d":
      case "xrp_1d": {
        const utcMs = now.getTime() - (i + 1) * MS_1D;
        const utc = new Date(utcMs);
        const uy = utc.getUTCFullYear();
        const um = utc.getUTCMonth() + 1;
        const ud = utc.getUTCDate();
        result.push(getBtc1dCandleStartAtUtc(`${uy}-${pad(um)}-${pad(ud)}`));
        break;
      }
      case "btc_4h":
      case "eth_4h":
      case "usdt_4h":
      case "xrp_4h": {
        // UTC 00, 04, 08, 12, 16, 20 (Binance 4h와 동일)
        const utcMs4h = now.getTime() - (i + 1) * MS_4H;
        const utc = new Date(utcMs4h);
        const uy = utc.getUTCFullYear();
        const um = utc.getUTCMonth() + 1;
        const ud = utc.getUTCDate();
        const uh = utc.getUTCHours();
        const utcDateStr = `${uy}-${pad(um)}-${pad(ud)}`;
        result.push(getBtc4hCandleStartAtUtc(utcDateStr, Math.floor(uh / 4)));
        break;
      }
      case "btc_1h":
      case "eth_1h":
      case "usdt_1h":
      case "xrp_1h":
        result.push(getBtc1hCandleStartAt(dateStr(dy, dm, dd), hh));
        break;
      case "btc_15m":
      case "eth_15m":
      case "usdt_15m":
      case "xrp_15m":
        result.push(getBtc15mCandleStartAt(dateStr(dy, dm, dd), hh, Math.floor(mm / 15)));
        break;
      case "btc_5m":
      case "eth_5m":
      case "usdt_5m":
      case "xrp_5m": {
        // UTC 기준 (바이낸스와 동일)
        const utcMs = now.getTime() - (i + 1) * MS_5M;
        const utc = new Date(utcMs);
        const uy = utc.getUTCFullYear();
        const um = utc.getUTCMonth() + 1;
        const ud = utc.getUTCDate();
        const uh = utc.getUTCHours();
        const umm = utc.getUTCMinutes();
        const utcDateStr = `${uy}-${String(um).padStart(2, "0")}-${String(ud).padStart(2, "0")}`;
        result.push(getBtc5mCandleStartAtUtc(utcDateStr, uh, Math.floor(umm / 5)));
        break;
      }
    }
  }

  return result;
}

/**
 * 현재 시각 기준, market에 해당하는 "진행 중인" 캔들의 candle_start_at
 * 예: btc_4h UTC → 00/04/08/12/16/20 UTC (Binance와 동일)
 */
export function getCurrentCandleStartAt(market: string): string {
  const now = new Date();
  const utcMs = now.getTime();
  const kstMs = utcMs + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  const h = kst.getUTCHours();
  const min = kst.getUTCMinutes();

  const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const mNorm =
    market === "btc" ? "btc_1d" : market === "eth" ? "eth_1d" : market === "usdt" ? "usdt_1d" : market === "xrp" ? "xrp_1d" : market;
  switch (mNorm) {
    case "btc_1d":
    case "eth_1d":
    case "usdt_1d":
    case "xrp_1d": {
      // btc_1d: Binance UTC 00:00 정렬. 투표 마감 KST 09:00 = UTC 00:00
      // 투표 기간 09:01~다음날 09:00. 현재 UTC 날짜의 캔들 = 다음 00:00 UTC에 마감
      // 예: UTC 03-06 15:00(KST 03-07 00:00) → 03-06 캔들(03-07 00:00 마감)
      return getBtc1dCandleStartAtUtc(getTodayUtcDateString());
    }
    case "btc_4h":
    case "eth_4h":
    case "usdt_4h":
    case "xrp_4h": {
      // UTC 00, 04, 08, 12, 16, 20 (Binance 4h와 동일, 1h 집계 없음)
      const utc = new Date(utcMs);
      const utcY = utc.getUTCFullYear();
      const utcM = utc.getUTCMonth() + 1;
      const utcD = utc.getUTCDate();
      const utcHour = utc.getUTCHours();
      const utcDateStr = `${utcY}-${String(utcM).padStart(2, "0")}-${String(utcD).padStart(2, "0")}`;
      const slot4h = Math.floor(utcHour / 4);
      return getBtc4hCandleStartAtUtc(utcDateStr, slot4h);
    }
    case "btc_1h":
    case "eth_1h":
    case "usdt_1h":
    case "xrp_1h":
    case "kospi_1h":
    case "kosdaq_1h":
    case "samsung_1h":
    case "skhynix_1h":
    case "hyundai_1h":
      return getBtc1hCandleStartAt(dateStr, h);
    case "btc_15m":
    case "eth_15m":
    case "usdt_15m":
    case "xrp_15m": {
      const slot15 = Math.floor(min / 15);
      return getBtc15mCandleStartAt(dateStr, h, slot15);
    }
    case "btc_5m":
    case "eth_5m":
    case "usdt_5m":
    case "xrp_5m": {
      // UTC 기준 (바이낸스와 동일) - 목표가 = 직전 5분봉 종가
      const utc = new Date(utcMs);
      const utcHour = utc.getUTCHours();
      const utcMin = utc.getUTCMinutes();
      const utcY = utc.getUTCFullYear();
      const utcM = utc.getUTCMonth() + 1;
      const utcD = utc.getUTCDate();
      const utcDateStr = `${utcY}-${String(utcM).padStart(2, "0")}-${String(utcD).padStart(2, "0")}`;
      const slot5 = Math.floor(utcMin / 5);
      return getBtc5mCandleStartAtUtc(utcDateStr, utcHour, slot5);
    }
    case "ndq_4h":
    case "sp500_4h":
    case "kospi_4h":
    case "kosdaq_4h":
    case "dow_jones_4h":
    case "wti_4h":
    case "xau_4h":
    case "shanghai_4h":
    case "nikkei_4h":
    case "eurostoxx50_4h":
    case "usd_krw_4h":
    case "jpy_krw_4h":
    case "usd10y_4h":
    case "usd30y_4h":
    case "hang_seng_4h": {
      // btc_4h와 동일: UTC 00, 04, 08, 12, 16, 20
      const utc = new Date(utcMs);
      const utcY = utc.getUTCFullYear();
      const utcM = utc.getUTCMonth() + 1;
      const utcD = utc.getUTCDate();
      const utcHour = utc.getUTCHours();
      const utcDateStr = `${utcY}-${String(utcM).padStart(2, "0")}-${String(utcD).padStart(2, "0")}`;
      const slot4h = Math.floor(utcHour / 4);
      return getBtc4hCandleStartAtUtc(utcDateStr, slot4h);
    }
    default:
      throw new Error(`Unsupported market: ${market}`);
  }
}

/** 투표 마감 시각을 이만큼 앞당김 (ms). 모든 시장 통일 10초 전 마감 */
export const VOTING_CLOSE_EARLY_MS = 10000;

/** 봉 주기(ms) - 목표가 = 이전 봉 종가 조회 시 사용 */
export const CANDLE_PERIOD_MS: Record<string, number> = {
  btc_5m: MS_5M,
  btc_15m: MS_15M,
  btc_1h: MS_1H,
  btc_4h: MS_4H,
  btc_1d: MS_1D,
  eth_5m: MS_5M,
  eth_15m: MS_15M,
  eth_1h: MS_1H,
  eth_4h: MS_4H,
  eth_1d: MS_1D,
  usdt_5m: MS_5M,
  usdt_15m: MS_15M,
  usdt_1h: MS_1H,
  usdt_4h: MS_4H,
  usdt_1d: MS_1D,
  xrp_5m: MS_5M,
  xrp_15m: MS_15M,
  xrp_1h: MS_1H,
  xrp_4h: MS_4H,
  xrp_1d: MS_1D,
  ndq_4h: MS_4H,
  sp500_4h: MS_4H,
  kospi_1h: MS_1H,
  kosdaq_1h: MS_1H,
  samsung_1h: MS_1H,
  skhynix_1h: MS_1H,
  hyundai_1h: MS_1H,
  kospi_1d: MS_1D,
  kosdaq_1d: MS_1D,
  samsung_1d: MS_1D,
  skhynix_1d: MS_1D,
  hyundai_1d: MS_1D,
  dow_jones_4h: MS_4H,
  wti_4h: MS_4H,
  xau_4h: MS_4H,
  shanghai_4h: MS_4H,
  nikkei_4h: MS_4H,
  eurostoxx50_4h: MS_4H,
  hang_seng_4h: MS_4H,
  usd_krw_4h: MS_4H,
  jpy_krw_4h: MS_4H,
  usd10y_4h: MS_4H,
  usd30y_4h: MS_4H,
};

/**
 * 현재 봉 candle_start_at에서 한 봉 이전의 candle_start_at
 * 목표가(이전 봉 종가) 조회 시 사용
 */
export function getPreviousCandleStartAt(
  market: string,
  candleStartAt: string
): string {
  const period = CANDLE_PERIOD_MS[market];
  if (period == null) return candleStartAt;
  const ms = new Date(candleStartAt).getTime() - period;
  return new Date(ms).toISOString();
}

/**
 * 현재 봉 candle_start_at에서 한 봉 다음의 candle_start_at
 * 정산된 폴 다음 "라이브" 폴 조회 시 사용
 */
export function getNextCandleStartAt(
  market: string,
  candleStartAt: string
): string {
  const period = CANDLE_PERIOD_MS[market];
  if (period == null) return candleStartAt;
  const ms = new Date(candleStartAt).getTime() + period;
  return new Date(ms).toISOString();
}
