/**
 * 캔들 시각 유틸
 *
 * - btc_1d: UTC 00:00 기준 (Binance 1d와 동일, 목표가·차트 일치)
 * - btc_4h, btc_1h, btc_15m: KST 00:00 기준
 */

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
 * btc_4h: poll_date 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 KST
 * @param slotIndex 0~5 (0=00:00, 1=04:00, ...)
 */
export function getBtc4hCandleStartAt(pollDate: string, slotIndex: number): string {
  const hour = slotIndex * 4;
  if (hour < 0 || hour > 20) throw new Error("slotIndex must be 0-5");
  return getCandleStartAt(pollDate, hour, 0);
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
 * poll_date에 해당하는 당일 캔들 candle_start_at 목록 (과거→미래 순)
 * - btc_1d: 1개 (poll_date = UTC YYYY-MM-DD, Binance 1d 정렬)
 * - btc_4h/1h/15m: poll_date = KST
 */
export function getCandlesForPollDate(
  market: string,
  pollDate: string
): string[] {
  const m = market === "btc" ? "btc_1d" : market;
  const result: string[] = [];

  switch (m) {
    case "btc_1d":
      result.push(getBtc1dCandleStartAtUtc(pollDate));
      break;
    case "btc_4h":
      for (let i = 0; i < 6; i++) {
        result.push(getBtc4hCandleStartAt(pollDate, i));
      }
      break;
    case "btc_1h":
      for (let h = 0; h < 24; h++) {
        result.push(getBtc1hCandleStartAt(pollDate, h));
      }
      break;
    case "btc_15m":
      for (let h = 0; h < 24; h++) {
        for (let s = 0; s < 4; s++) {
          result.push(getBtc15mCandleStartAt(pollDate, h, s));
        }
      }
      break;
    case "ndq":
    case "sp500":
    case "kospi":
    case "kosdaq":
      result.push(getBtc1dCandleStartAt(pollDate));
      break;
    default:
      return [];
  }

  return result;
}

/** market별 poll_date의 첫 캔들 candle_start_at (btc_1d는 UTC 00:00, 나머지는 KST) */
export function getCandleStartAtForMarket(
  market: string,
  pollDate: string,
  options?: { hour?: number; slot4h?: number; slot15m?: number }
): string {
  const m = market === "btc" ? "btc_1d" : market;
  switch (m) {
    case "btc_1d":
      return getBtc1dCandleStartAtUtc(pollDate);
    case "btc_4h":
      return getBtc4hCandleStartAt(pollDate, options?.slot4h ?? 0);
    case "btc_1h":
      return getBtc1hCandleStartAt(pollDate, options?.hour ?? 0);
    case "btc_15m":
      return getBtc15mCandleStartAt(
        pollDate,
        options?.hour ?? 0,
        options?.slot15m ?? 0
      );
    default:
      throw new Error(`Unsupported market for candle: ${market}`);
  }
}

const MS_15M = 15 * 60 * 1000;
const MS_1H = 60 * 60 * 1000;
const MS_4H = 4 * MS_1H;
const MS_1D = 24 * MS_1H;

/**
 * 최근 N개의 마감된 캔들 candle_start_at 목록 (과거부터 시간순)
 * @param market btc_1d | btc_4h | btc_1h | btc_15m
 * @param count 가져올 캔들 수
 */
export function getRecentCandleStartAts(
  market: string,
  count: number
): string[] {
  const m = market === "btc" ? "btc_1d" : market;
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
        targetKstMs = kstMs - (i + 1) * MS_1D;
        break;
      case "btc_4h":
        targetKstMs = kstMs - (i + 1) * MS_4H;
        break;
      case "btc_1h":
        targetKstMs = kstMs - (i + 1) * MS_1H;
        break;
      case "btc_15m":
        targetKstMs = kstMs - (i + 1) * MS_15M;
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
      case "btc_1d": {
        const utcMs = now.getTime() - (i + 1) * MS_1D;
        const utc = new Date(utcMs);
        const uy = utc.getUTCFullYear();
        const um = utc.getUTCMonth() + 1;
        const ud = utc.getUTCDate();
        result.push(getBtc1dCandleStartAtUtc(`${uy}-${pad(um)}-${pad(ud)}`));
        break;
      }
      case "btc_4h":
        result.push(getBtc4hCandleStartAt(dateStr(dy, dm, dd), Math.floor(hh / 4)));
        break;
      case "btc_1h":
        result.push(getBtc1hCandleStartAt(dateStr(dy, dm, dd), hh));
        break;
      case "btc_15m":
        result.push(getBtc15mCandleStartAt(dateStr(dy, dm, dd), hh, Math.floor(mm / 15)));
        break;
    }
  }

  return result;
}

/**
 * 현재 시각 기준, market에 해당하는 "진행 중인" 캔들의 candle_start_at
 * 예: btc_4h, 현재 KST 10:30 → 08:00 KST 시작 캔들
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

  const mNorm = market === "btc" ? "btc_1d" : market;
  switch (mNorm) {
    case "btc_1d":
      return getBtc1dCandleStartAt(dateStr);
    case "btc_4h": {
      const slot = Math.floor(h / 4) * 4;
      return getBtc4hCandleStartAt(dateStr, slot / 4);
    }
    case "btc_1h":
      return getBtc1hCandleStartAt(dateStr, h);
    case "btc_15m": {
      const slot15 = Math.floor(min / 15);
      return getBtc15mCandleStartAt(dateStr, h, slot15);
    }
    default:
      throw new Error(`Unsupported market: ${market}`);
  }
}

/** 봉 주기(ms) - 목표가 = 이전 봉 종가 조회 시 사용 */
export const CANDLE_PERIOD_MS: Record<string, number> = {
  btc_15m: MS_15M,
  btc_1h: MS_1H,
  btc_4h: MS_4H,
  btc_1d: MS_1D,
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
