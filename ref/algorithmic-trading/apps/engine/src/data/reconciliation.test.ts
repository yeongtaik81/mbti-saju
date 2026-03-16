import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema.js';
import { BalanceReconciler, MismatchType } from './reconciliation.js';
import type { KisRestClient } from '../kis/rest-client.js';

function makeMockClient(balanceItems: unknown[] = []): KisRestClient {
  return {
    getBalance: async () => ({
      items: balanceItems,
      summary: {
        dnca_tot_amt: '10000000',
        tot_evlu_amt: '17200000',
        pchs_amt_smtl_amt: '7000000',
        evlu_amt_smtl_amt: '7200000',
        evlu_pfls_smtl_amt: '200000'
      }
    })
  } as unknown as KisRestClient;
}

describe('BalanceReconciler', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('일치 시 빈 배열을 반환한다', async () => {
    // KIS에 005930 100주
    const client = makeMockClient([
      {
        pdno: '005930',
        prdt_name: '삼성전자',
        hldg_qty: '100',
        pchs_avg_pric: '70000',
        prpr: '72000',
        evlu_pfls_amt: '200000',
        evlu_pfls_rt: '2.86',
        evlu_amt: '7200000'
      }
    ]);

    // 로컬에도 005930 100주
    db.prepare(
      `
      INSERT INTO positions (stock_code, stock_name, quantity, avg_price, bought_at)
      VALUES ('005930', '삼성전자', 100, 70000, datetime('now', 'localtime'))
    `
    ).run();

    const reconciler = new BalanceReconciler(db, client);
    const mismatches = await reconciler.reconcile();
    assert.equal(mismatches.length, 0);
  });

  it('missing_local: KIS에만 존재하는 종목을 감지한다', async () => {
    const client = makeMockClient([
      {
        pdno: '005930',
        prdt_name: '삼성전자',
        hldg_qty: '100',
        pchs_avg_pric: '70000',
        prpr: '72000',
        evlu_pfls_amt: '200000',
        evlu_pfls_rt: '2.86',
        evlu_amt: '7200000'
      }
    ]);

    const reconciler = new BalanceReconciler(db, client);
    const mismatches = await reconciler.reconcile();

    assert.equal(mismatches.length, 1);
    assert.equal(mismatches[0]!.type, MismatchType.MISSING_LOCAL);
    assert.equal(mismatches[0]!.stockCode, '005930');
  });

  it('missing_kis: 로컬에만 존재하는 종목을 감지한다', async () => {
    const client = makeMockClient([]);

    db.prepare(
      `
      INSERT INTO positions (stock_code, stock_name, quantity, avg_price, bought_at)
      VALUES ('005930', '삼성전자', 100, 70000, datetime('now', 'localtime'))
    `
    ).run();

    const reconciler = new BalanceReconciler(db, client);
    const mismatches = await reconciler.reconcile();

    assert.equal(mismatches.length, 1);
    assert.equal(mismatches[0]!.type, MismatchType.MISSING_KIS);
  });

  it('quantity_mismatch: 수량 불일치를 감지한다', async () => {
    const client = makeMockClient([
      {
        pdno: '005930',
        prdt_name: '삼성전자',
        hldg_qty: '150',
        pchs_avg_pric: '70000',
        prpr: '72000',
        evlu_pfls_amt: '300000',
        evlu_pfls_rt: '2.86',
        evlu_amt: '10800000'
      }
    ]);

    db.prepare(
      `
      INSERT INTO positions (stock_code, stock_name, quantity, avg_price, bought_at)
      VALUES ('005930', '삼성전자', 100, 70000, datetime('now', 'localtime'))
    `
    ).run();

    const reconciler = new BalanceReconciler(db, client);
    const mismatches = await reconciler.reconcile();

    assert.equal(mismatches.length, 1);
    assert.equal(mismatches[0]!.type, MismatchType.QUANTITY_MISMATCH);
    assert.equal(mismatches[0]!.kisQuantity, 150);
    assert.equal(mismatches[0]!.localQuantity, 100);
  });

  it('syncFromKis는 missing_local을 INSERT한다', async () => {
    const client = makeMockClient([
      {
        pdno: '005930',
        prdt_name: '삼성전자',
        hldg_qty: '100',
        pchs_avg_pric: '70000',
        prpr: '72000',
        evlu_pfls_amt: '200000',
        evlu_pfls_rt: '2.86',
        evlu_amt: '7200000'
      }
    ]);

    const reconciler = new BalanceReconciler(db, client);
    const result = await reconciler.syncFromKis();

    assert.equal(result.synced.length, 1);
    assert.equal(result.synced[0]!, '005930');

    const rows = db.prepare('SELECT * FROM positions').all() as Array<
      Record<string, unknown>
    >;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.stock_code, '005930');
    assert.equal(rows[0]!.quantity, 100);
  });

  it('syncFromKis는 missing_kis에 대해 경고만 한다 (삭제 안 함)', async () => {
    const client = makeMockClient([]);

    db.prepare(
      `
      INSERT INTO positions (stock_code, stock_name, quantity, avg_price, bought_at)
      VALUES ('005930', '삼성전자', 100, 70000, datetime('now', 'localtime'))
    `
    ).run();

    const reconciler = new BalanceReconciler(db, client);
    const result = await reconciler.syncFromKis();

    assert.equal(result.warnings.length, 1);
    assert.ok(result.warnings[0]!.includes('005930'));

    // 로컬 데이터가 삭제되지 않았는지 확인
    const rows = db.prepare('SELECT * FROM positions').all();
    assert.equal(rows.length, 1);
  });
});
