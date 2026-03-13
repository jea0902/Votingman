/**
 * 코스피/코스닥 캔들 시각 유틸
 * - candle_start_at은 모두 UTC 기준 (1일봉: UTC 00:00, 4시간봉: UTC 00/04/08/12/16/20)
 */

const POLL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseUtcDate(utcDate: string): { y: number; m: number; d: number } {
  if (!POLL_DATE_REGEX.test(utcDate)) {
    throw new Error("utcDate must be YYYY-MM-DD");
  }
  const [y, m, d] = utcDate.split("-").map(Number);
  if (!y || !m || !d) throw new Error("utcDate must be YYYY-MM-DD");
  return { y, m, d };
}

/** 1일봉: 해당 UTC 날짜 00:00:00.000Z */
export function getKorea1dCandleStartAtUtc(utcDate: string): string {
  const { y, m, d } = parseUtcDate(utcDate);
  const ms = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  return new Date(ms).toISOString();
}

/** 4시간봉: UTC 00:00, 04:00, 08:00, 12:00, 16:00, 20:00. slotIndex 0~5 */
export function getKorea4hCandleStartAtUtc(
  utcDate: string,
  slotIndex: number
): string {
  const hour = slotIndex * 4;
  if (hour < 0 || hour > 20) throw new Error("slotIndex must be 0-5");
  const { y, m, d } = parseUtcDate(utcDate);
  const ms = Date.UTC(y, m - 1, d, hour, 0, 0, 0);
  return new Date(ms).toISOString();
}

const MS_4H = 4 * 60 * 60 * 1000;
const MS_1D = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 최근 N개 캔들 candle_start_at (UTC, 과거부터 시간순)
 * kospi_1d, kospi_4h, kosdaq_1d, kosdaq_4h
 */
export function getRecentKoreaCandleStartAts(
  market: string,
  count: number
): string[] {
  const now = new Date();
  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    if (market === "kospi_1d" || market === "kosdaq_1d") {
      const utcMs = now.getTime() - (i + 1) * MS_1D;
      const utc = new Date(utcMs);
      const uy = utc.getUTCFullYear();
      const um = utc.getUTCMonth() + 1;
      const ud = utc.getUTCDate();
      result.push(getKorea1dCandleStartAtUtc(`${uy}-${pad(um)}-${pad(ud)}`));
    } else if (market === "kospi_4h" || market === "kosdaq_4h") {
      const utcMs = now.getTime() - (i + 1) * MS_4H;
      const utc = new Date(utcMs);
      const uy = utc.getUTCFullYear();
      const um = utc.getUTCMonth() + 1;
      const ud = utc.getUTCDate();
      const uh = utc.getUTCHours();
      const utcDateStr = `${uy}-${pad(um)}-${pad(ud)}`;
      result.push(
        getKorea4hCandleStartAtUtc(utcDateStr, Math.floor(uh / 4))
      );
    } else {
      return [];
    }
  }

  return result;
}

/** candle_start_at 표준화 (UTC ISO). btc-ohlc와 동일 규칙 */
export { toCanonicalCandleStartAt } from "@/lib/btc-ohlc/candle-utils";
