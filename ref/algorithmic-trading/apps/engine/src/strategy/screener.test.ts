import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { AutoScreener } from './screener.js';
import type { ScreeningParams } from '@trading/shared/types';
import type { KisRestClient } from '../kis/rest-client.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
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
    CREATE TABLE screening_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      market_cap REAL NOT NULL DEFAULT 0,
      volume_amount REAL NOT NULL DEFAULT 0,
      atr REAL NOT NULL DEFAULT 0,
      rank INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(date, stock_code)
    );
  `);
  return db;
}

function seedCandles(
  db: Database.Database,
  stockCode: string,
  days: number = 30
): void {
  const insert = db.prepare(`
    INSERT INTO daily_candles (stock_code, date, open, high, low, close, volume, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (let i = 0; i < days; i++) {
    const d = String(i + 1).padStart(2, '0');
    const date = `2026-02-${d}`;
    const base = 70000 + i * 100;
    insert.run(
      stockCode,
      date,
      base,
      base + 1500,
      base - 500,
      base + 500,
      15000000,
      1_000_000_000_000
    );
  }
}

function makeMockRestClient(
  priceMap: Record<
    string,
    {
      price: string;
      marketCap: string;
      volumeAmount: string;
    }
  >
): KisRestClient {
  return {
    getCurrentPrice: async (stockCode: string) => {
      const data = priceMap[stockCode];
      if (!data) throw new Error('Not found');
      return {
        stck_prpr: data.price,
        stck_oprc: data.price,
        stck_hgpr: data.price,
        stck_lwpr: data.price,
        acml_vol: '15000000',
        acml_tr_pbmn: data.volumeAmount,
        hts_avls: data.marketCap,
        stck_mxpr: '100000',
        stck_llam: '50000'
      };
    }
  } as unknown as KisRestClient;
}

const defaultParams: ScreeningParams = {
  minMarketCap: 500_000_000_000, // 5000억
  minVolumeAmount: 500_000_000_000, // 5000억
  minPrice: 5000,
  maxPrice: 500000,
  maxCandidates: 10,
  markets: ['KOSPI', 'KOSDAQ']
};

describe('AutoScreener', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it('스크리닝 조건을 충족하는 종목을 반환한다', async () => {
    seedCandles(db, '005930', 25);
    seedCandles(db, '000660', 25);

    const restClient = makeMockRestClient({
      '005930': {
        price: '72000',
        marketCap: '430000000000000',
        volumeAmount: '1080000000000'
      },
      '000660': {
        price: '160000',
        marketCap: '120000000000000',
        volumeAmount: '800000000000'
      }
    });

    const screener = new AutoScreener({ db, restClient });
    const result = await screener.screen(defaultParams, '2026-02-25');

    assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[0]!.rank, 1);
    // 거래대금 순 정렬: 삼성전자 > SK하이닉스
    assert.equal(result.candidates[0]!.stockCode, '005930');
    assert.equal(result.candidates[1]!.stockCode, '000660');
  });

  it('시가총액이 미달인 종목을 제외한다', async () => {
    seedCandles(db, '005930', 25);

    const restClient = makeMockRestClient({
      '005930': {
        price: '72000',
        marketCap: '100000000000',
        volumeAmount: '1080000000000'
      } // 1000억 (기준 미달)
    });

    const screener = new AutoScreener({ db, restClient });
    const result = await screener.screen(defaultParams, '2026-02-25');

    assert.equal(result.candidates.length, 0);
  });

  it('거래대금이 미달인 종목을 제외한다', async () => {
    seedCandles(db, '005930', 25);

    const restClient = makeMockRestClient({
      '005930': {
        price: '72000',
        marketCap: '430000000000000',
        volumeAmount: '100000000000'
      } // 1000억 (기준 미달)
    });

    const screener = new AutoScreener({ db, restClient });
    const result = await screener.screen(defaultParams, '2026-02-25');

    assert.equal(result.candidates.length, 0);
  });

  it('가격 범위를 벗어난 종목을 제외한다', async () => {
    seedCandles(db, '005930', 25);

    const restClient = makeMockRestClient({
      '005930': {
        price: '600000',
        marketCap: '430000000000000',
        volumeAmount: '1080000000000'
      } // maxPrice 초과
    });

    const screener = new AutoScreener({ db, restClient });
    const result = await screener.screen(defaultParams, '2026-02-25');

    assert.equal(result.candidates.length, 0);
  });

  it('maxCandidates로 결과를 제한한다', async () => {
    for (const code of ['005930', '000660', '035420']) {
      seedCandles(db, code, 25);
    }

    const restClient = makeMockRestClient({
      '005930': {
        price: '72000',
        marketCap: '430000000000000',
        volumeAmount: '1080000000000'
      },
      '000660': {
        price: '160000',
        marketCap: '120000000000000',
        volumeAmount: '800000000000'
      },
      '035420': {
        price: '300000',
        marketCap: '50000000000000',
        volumeAmount: '600000000000'
      }
    });

    const screener = new AutoScreener({ db, restClient });
    const result = await screener.screen(
      { ...defaultParams, maxCandidates: 2 },
      '2026-02-25'
    );

    assert.equal(result.candidates.length, 2);
  });

  it('결과를 DB에 저장하고 조회할 수 있다', async () => {
    seedCandles(db, '005930', 25);

    const restClient = makeMockRestClient({
      '005930': {
        price: '72000',
        marketCap: '430000000000000',
        volumeAmount: '1080000000000'
      }
    });

    const screener = new AutoScreener({ db, restClient });
    await screener.screen(defaultParams, '2026-02-25');

    const results = screener.getLatestResults('2026-02-25');
    assert.equal(results.length, 1);
    assert.equal(results[0]!.stockCode, '005930');
    assert.equal(results[0]!.rank, 1);
  });

  it('API 조회 실패 종목을 스킵한다', async () => {
    seedCandles(db, '005930', 25);
    seedCandles(db, '999999', 25); // API에서 조회 불가

    const restClient = makeMockRestClient({
      '005930': {
        price: '72000',
        marketCap: '430000000000000',
        volumeAmount: '1080000000000'
      }
    });

    const screener = new AutoScreener({ db, restClient });
    const result = await screener.screen(defaultParams, '2026-02-25');

    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]!.stockCode, '005930');
  });
});
