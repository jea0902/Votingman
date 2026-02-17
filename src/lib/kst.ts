/**
 * KST(한국 표준시) 시각 유틸
 * - DB에 KST로 저장하는 컬럼(created_at, updated_at, settled_at 등)용
 */

/** 현재 시각을 KST 기준 'YYYY-MM-DD HH:mm:ss'로 반환 */
export function nowKstString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  const h = String(kst.getUTCHours()).padStart(2, "0");
  const min = String(kst.getUTCMinutes()).padStart(2, "0");
  const s = String(kst.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}
