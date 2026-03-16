import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema.js';
import { CandleCollector } from './candle-collector.js';
import type { KisRestClient } from '../kis/rest-client.js';

function makeMockClient(
  dailyItems: unknown[] = [],
  minuteItems: unknown[] = []
): KisRestClient {
  return {
    getDailyCandles: async () => dailyItems,
    getMinuteCandles: async () => minuteItems
  } as unknown as KisRestClient;
}

describe('CandleCollector', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('일봉을 수집하여 DB에 저장한다', async () => {
    const client = makeMockClient([
      {
        stck_bsop_date: '20260301',
        stck_oprc: '71500',
        stck_hgpr: '72500',
        stck_lwpr: '71000',
        stck_clpr: '72000',
        acml_vol: '15000000',
        acml_tr_pbmn: '1080000000000'
      },
      {
        stck_bsop_date: '20260302',
        stck_oprc: '72000',
        stck_hgpr: '73000',
        stck_lwpr: '71500',
        stck_clpr: '72500',
        acml_vol: '12000000',
        acml_tr_pbmn: '870000000000'
      }
    ]);

    const collector = new CandleCollector(db, client);
    const count = await collector.collectDailyCandles(
      '005930',
      '20260301',
      '20260302'
    );

    assert.equal(count, 2);

    const rows = db
      .prepare('SELECT * FROM daily_candles WHERE stock_code = ?')
      .all('005930');
    assert.equal(rows.length, 2);
  });

  it('분봉을 수집하여 DB에 저장한다', async () => {
    const client = makeMockClient(
      [],
      [
        {
          stck_bsop_date: '20260301',
          stck_cntg_hour: '093000',
          stck_oprc: '71500',
          stck_hgpr: '72500',
          stck_lwpr: '71000',
          stck_prpr: '72000',
          cntg_vol: '5000'
        }
      ]
    );

    const collector = new CandleCollector(db, client);
    const count = await collector.collectMinuteCandles('005930');

    assert.equal(count, 1);

    const rows = db
      .prepare('SELECT * FROM minute_candles WHERE stock_code = ?')
      .all('005930') as Array<Record<string, unknown>>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.datetime, '2026-03-01 09:30');
  });

  it('getLatestCachedDate로 마지막 캐시 날짜를 반환한다', async () => {
    const client = makeMockClient([
      {
        stck_bsop_date: '20260301',
        stck_oprc: '71500',
        stck_hgpr: '72500',
        stck_lwpr: '71000',
        stck_clpr: '72000',
        acml_vol: '15000000',
        acml_tr_pbmn: '1000000000'
      }
    ]);

    const collector = new CandleCollector(db, client);
    await collector.collectDailyCandles('005930', '20260301', '20260301');

    const latest = collector.getLatestCachedDate('005930');
    assert.equal(latest, '2026-03-01');

    const empty = collector.getLatestCachedDate('999999');
    assert.equal(empty, null);
  });

  it('INSERT OR REPLACE로 중복 데이터를 덮어쓴다', async () => {
    const client = makeMockClient([
      {
        stck_bsop_date: '20260301',
        stck_oprc: '71500',
        stck_hgpr: '72500',
        stck_lwpr: '71000',
        stck_clpr: '72000',
        acml_vol: '15000000',
        acml_tr_pbmn: '1000000000'
      }
    ]);

    const collector = new CandleCollector(db, client);
    await collector.collectDailyCandles('005930', '20260301', '20260301');
    await collector.collectDailyCandles('005930', '20260301', '20260301');

    const rows = db
      .prepare('SELECT * FROM daily_candles WHERE stock_code = ?')
      .all('005930');
    assert.equal(rows.length, 1);
  });
});
