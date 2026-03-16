import type Database from 'better-sqlite3';
import type { KisRestClient } from '../kis/rest-client.js';
import { toCandle, toMinuteCandle } from '../kis/mappers.js';

/**
 * 일봉/분봉 데이터 수집 → DB 저장
 */
export class CandleCollector {
  private readonly db: Database.Database;
  private readonly client: KisRestClient;

  private readonly insertDaily: Database.Statement;
  private readonly insertMinute: Database.Statement;
  private readonly getLatestDate: Database.Statement;

  constructor(db: Database.Database, client: KisRestClient) {
    this.db = db;
    this.client = client;

    this.insertDaily = db.prepare(`
      INSERT OR REPLACE INTO daily_candles (stock_code, date, open, high, low, close, adj_close, volume, amount)
      VALUES (@stockCode, @date, @open, @high, @low, @close, @adjClose, @volume, @amount)
    `);

    this.insertMinute = db.prepare(`
      INSERT OR REPLACE INTO minute_candles (stock_code, datetime, open, high, low, close, volume)
      VALUES (@stockCode, @datetime, @open, @high, @low, @close, @volume)
    `);

    this.getLatestDate = db.prepare(`
      SELECT MAX(date) as latest FROM daily_candles WHERE stock_code = ?
    `);
  }

  /** 일봉 수집 → DB 저장 */
  async collectDailyCandles(
    stockCode: string,
    startDate: string, // YYYYMMDD
    endDate: string // YYYYMMDD
  ): Promise<number> {
    const items = await this.client.getDailyCandles(
      stockCode,
      startDate,
      endDate
    );
    const candles = items.map((item) => toCandle(item, stockCode));

    const insertMany = this.db.transaction(() => {
      for (const candle of candles) {
        this.insertDaily.run({
          stockCode: candle.stockCode,
          date: candle.date,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          adjClose: candle.adjClose ?? null,
          volume: candle.volume,
          amount: candle.amount ?? 0
        });
      }
    });

    insertMany();
    return candles.length;
  }

  /** 분봉 수집 → DB 저장 */
  async collectMinuteCandles(
    stockCode: string,
    time?: string // HHMMSS
  ): Promise<number> {
    const items = await this.client.getMinuteCandles(stockCode, time);
    const candles = items.map((item) => toMinuteCandle(item, stockCode));

    const insertMany = this.db.transaction(() => {
      for (const candle of candles) {
        this.insertMinute.run({
          stockCode: candle.stockCode,
          datetime: candle.datetime,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        });
      }
    });

    insertMany();
    return candles.length;
  }

  /** 여러 종목 일봉 순차 수집 */
  async collectDailyCandlesBatch(
    stockCodes: string[],
    startDate: string,
    endDate: string
  ): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    for (const code of stockCodes) {
      const count = await this.collectDailyCandles(code, startDate, endDate);
      results.set(code, count);
    }
    return results;
  }

  /** 마지막 캐시된 날짜 조회 */
  getLatestCachedDate(stockCode: string): string | null {
    const row = this.getLatestDate.get(stockCode) as
      | { latest: string | null }
      | undefined;
    return row?.latest ?? null;
  }

  /** 갭 채우기: 마지막 캐시 이후 일봉만 수집 */
  async gapFill(stockCode: string, endDate: string): Promise<number> {
    const latest = this.getLatestCachedDate(stockCode);
    if (!latest) {
      // 캐시 없음 → 전체 수집 (90일)
      const d = new Date(endDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
      d.setDate(d.getDate() - 90);
      const startDate = d.toISOString().slice(0, 10).replace(/-/g, '');
      return this.collectDailyCandles(stockCode, startDate, endDate);
    }

    // latest는 YYYY-MM-DD 형식 → 다음 날부터 수집 (중복 방지)
    const d = new Date(latest);
    d.setDate(d.getDate() + 1);
    const startDate = d.toISOString().slice(0, 10).replace(/-/g, '');
    if (startDate > endDate) return 0; // 이미 최신
    return this.collectDailyCandles(stockCode, startDate, endDate);
  }
}
