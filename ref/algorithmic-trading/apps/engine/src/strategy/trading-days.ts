import type Database from 'better-sqlite3';

/**
 * 두 날짜 사이의 거래일 수 계산
 * daily_candles의 DISTINCT date를 거래일로 사용
 *
 * @param db DB 인스턴스
 * @param fromDate 시작일 (exclusive, YYYY-MM-DD)
 * @param toDate 종료일 (inclusive, YYYY-MM-DD)
 * @returns 거래일 수
 */
export function countTradingDaysSince(
  db: Database.Database,
  fromDate: string,
  toDate: string
): number {
  const row = db
    .prepare(
      `
    SELECT COUNT(DISTINCT date) as cnt
    FROM daily_candles
    WHERE date > ? AND date <= ?
  `
    )
    .get(fromDate, toDate) as { cnt: number };
  return row.cnt;
}
