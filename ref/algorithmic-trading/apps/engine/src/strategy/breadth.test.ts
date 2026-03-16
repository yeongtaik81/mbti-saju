import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { BreadthCalculator } from './breadth.js';
import { MarketRegime } from '@trading/shared/types';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE daily_candles (
      stock_code TEXT NOT NULL,
      date TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume INTEGER NOT NULL DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (stock_code, date)
    );
  `);
  return db;
}

/** N개 종목의 20일 캔들 데이터 생성 */
function seedCandles(
  db: Database.Database,
  stockCount: number,
  opts: { aboveRatio: number }
): void {
  const insert = db.prepare(
    'INSERT INTO daily_candles (stock_code, date, open, high, low, close, volume, amount) VALUES (?,?,?,?,?,?,?,?)'
  );

  const aboveCount = Math.floor(stockCount * opts.aboveRatio);

  const insertMany = db.transaction(() => {
    for (let s = 0; s < stockCount; s++) {
      const code = String(s).padStart(6, '0');
      // 상승 종목: 20일 평균 100, 최종 종가 120 (above SMA)
      // 하락 종목: 20일 평균 100, 최종 종가 80 (below SMA)
      const isAbove = s < aboveCount;

      for (let d = 1; d <= 20; d++) {
        const date = `2024-01-${String(d).padStart(2, '0')}`;
        const close = d < 20 ? 100 : isAbove ? 120 : 80;
        insert.run(
          code,
          date,
          close,
          close + 5,
          close - 5,
          close,
          1000,
          100000
        );
      }
    }
  });
  insertMany();
}

describe('BreadthCalculator', () => {
  let db: Database.Database;
  let calc: BreadthCalculator;

  beforeEach(() => {
    db = createTestDb();
    calc = new BreadthCalculator(db);
  });

  it('breadth 정확 계산 (60% above)', () => {
    seedCandles(db, 200, { aboveRatio: 0.6 });
    const breadth = calc.computeBreadth('2024-01-20', 20);
    assert.ok(
      Math.abs(breadth - 0.6) < 0.01,
      `Expected ~0.6 but got ${breadth}`
    );
  });

  it('breadth 100% above', () => {
    seedCandles(db, 150, { aboveRatio: 1.0 });
    const breadth = calc.computeBreadth('2024-01-20', 20);
    assert.ok(Math.abs(breadth - 1.0) < 0.01);
  });

  it('breadth 0% above', () => {
    seedCandles(db, 150, { aboveRatio: 0.0 });
    const breadth = calc.computeBreadth('2024-01-20', 20);
    assert.ok(Math.abs(breadth - 0.0) < 0.01);
  });

  it('종목 100개 미만이면 -1 반환', () => {
    seedCandles(db, 50, { aboveRatio: 0.5 });
    const breadth = calc.computeBreadth('2024-01-20', 20);
    assert.strictEqual(breadth, -1);
  });

  it('getRegime: BULL', () => {
    assert.strictEqual(calc.getRegime(0.55, 0.5, 0.4), MarketRegime.BULL);
  });

  it('getRegime: BEAR', () => {
    assert.strictEqual(calc.getRegime(0.35, 0.5, 0.4), MarketRegime.BEAR);
  });

  it('getRegime: NEUTRAL (사이값)', () => {
    assert.strictEqual(calc.getRegime(0.45, 0.5, 0.4), MarketRegime.NEUTRAL);
  });

  it('getRegime: NEUTRAL (데이터 부족)', () => {
    assert.strictEqual(calc.getRegime(-1, 0.5, 0.4), MarketRegime.NEUTRAL);
  });

  it('getRegime: 경계값 — bullThreshold 정확히 일치', () => {
    assert.strictEqual(calc.getRegime(0.5, 0.5, 0.4), MarketRegime.BULL);
  });

  it('getRegime: 경계값 — bearThreshold 바로 위', () => {
    assert.strictEqual(calc.getRegime(0.4, 0.5, 0.4), MarketRegime.NEUTRAL);
  });
});
