import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { countTradingDaysSince } from './trading-days.js';

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

/** 거래일만 삽입 (주말 제외) */
function seedTradingDays(db: Database.Database, dates: string[]): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO daily_candles (stock_code, date, open, high, low, close, volume, amount) VALUES (?,?,100,105,95,100,1000,100000)'
  );
  const insertMany = db.transaction(() => {
    for (const date of dates) {
      insert.run('005930', date);
    }
  });
  insertMany();
}

describe('countTradingDaysSince', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('연속 5 거래일', () => {
    seedTradingDays(db, [
      '2024-01-08', // 월
      '2024-01-09', // 화
      '2024-01-10', // 수
      '2024-01-11', // 목
      '2024-01-12' // 금
    ]);
    // 1/8 매수 → 1/12까지 = 4 거래일 (1/8 exclusive)
    assert.strictEqual(
      countTradingDaysSince(db, '2024-01-08', '2024-01-12'),
      4
    );
  });

  it('주말 포함 시 거래일만 계산', () => {
    seedTradingDays(db, [
      '2024-01-08', // 월
      '2024-01-09', // 화
      '2024-01-10', // 수
      '2024-01-11', // 목
      '2024-01-12', // 금
      // 주말 (1/13, 1/14) 없음
      '2024-01-15', // 월
      '2024-01-16' // 화
    ]);
    // 1/8 매수 (exclusive) → 1/16까지: 9,10,11,12,15,16 = 6 거래일
    assert.strictEqual(
      countTradingDaysSince(db, '2024-01-08', '2024-01-16'),
      6
    );
  });

  it('동일 날짜면 0', () => {
    seedTradingDays(db, ['2024-01-08']);
    assert.strictEqual(
      countTradingDaysSince(db, '2024-01-08', '2024-01-08'),
      0
    );
  });

  it('데이터 없는 구간이면 0', () => {
    assert.strictEqual(
      countTradingDaysSince(db, '2024-01-01', '2024-01-05'),
      0
    );
  });

  it('공휴일 제외 (캔들 없음)', () => {
    seedTradingDays(db, [
      '2024-01-08',
      '2024-01-09',
      // 1/10 공휴일 (캔들 없음)
      '2024-01-11',
      '2024-01-12'
    ]);
    assert.strictEqual(
      countTradingDaysSince(db, '2024-01-08', '2024-01-12'),
      3
    );
  });

  it('여러 종목이 있어도 DISTINCT date로 중복 제거', () => {
    const insert = db.prepare(
      'INSERT INTO daily_candles (stock_code, date, open, high, low, close, volume, amount) VALUES (?,?,100,105,95,100,1000,100000)'
    );
    insert.run('005930', '2024-01-08');
    insert.run('000660', '2024-01-08');
    insert.run('005930', '2024-01-09');
    insert.run('000660', '2024-01-09');

    assert.strictEqual(
      countTradingDaysSince(db, '2024-01-08', '2024-01-09'),
      1
    );
  });
});
