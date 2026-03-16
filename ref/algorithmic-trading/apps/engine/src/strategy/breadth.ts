import type Database from 'better-sqlite3';
import { MarketRegime } from '@trading/shared/types';
import type { MarketRegime as MarketRegimeType } from '@trading/shared/types';

/**
 * 시장 breadth 계산기
 * breadth = 전체 종목 중 close > N일 SMA인 비율
 */
export class BreadthCalculator {
  private readonly stmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.stmt = this.db.prepare(`
      WITH trading_dates AS (
        SELECT DISTINCT date FROM daily_candles
        WHERE date <= ?
        ORDER BY date DESC
        LIMIT ?
      ),
      stock_sma AS (
        SELECT dc.stock_code, AVG(dc.close) as sma_val
        FROM daily_candles dc
        JOIN trading_dates td ON dc.date = td.date
        GROUP BY dc.stock_code
        HAVING COUNT(*) >= ?
      ),
      latest_close AS (
        SELECT dc.stock_code, dc.close
        FROM daily_candles dc
        WHERE dc.date = (SELECT MAX(date) FROM trading_dates)
      )
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN lc.close > ss.sma_val THEN 1 ELSE 0 END) as above
      FROM latest_close lc
      JOIN stock_sma ss ON lc.stock_code = ss.stock_code
    `);
  }

  /**
   * 시장 breadth 계산
   * @param date 기준일 (YYYY-MM-DD)
   * @param maPeriod MA 기간 (기본 20)
   * @returns 0.0 ~ 1.0 (종목 100개 미만이면 -1 반환)
   */
  computeBreadth(date: string, maPeriod: number = 20): number {
    const minDataPoints = Math.floor(maPeriod * 0.75);
    const row = this.stmt.get(date, maPeriod, minDataPoints) as {
      total: number;
      above: number;
    };

    if (row.total < 100) return -1;
    return row.above / row.total;
  }

  /** breadth 값으로 레짐 판별 */
  getRegime(
    breadth: number,
    bullThreshold: number,
    bearThreshold: number
  ): MarketRegimeType {
    if (breadth < 0) return MarketRegime.NEUTRAL; // 데이터 부족
    if (breadth >= bullThreshold) return MarketRegime.BULL;
    if (breadth < bearThreshold) return MarketRegime.BEAR;
    return MarketRegime.NEUTRAL;
  }
}
