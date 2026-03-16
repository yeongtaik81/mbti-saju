import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { StockMasterSync } from './stock-master.js';
import type { KisRestClient } from '../kis/rest-client.js';

function makeMockClient(): KisRestClient {
  return {
    getCurrentPrice: mock.fn(async () => ({
      stck_prpr: '72000',
      stck_oprc: '71500',
      stck_hgpr: '72500',
      stck_lwpr: '71000',
      acml_vol: '15000000',
      acml_tr_pbmn: '1080000000000',
      hts_avls: '430000000000000',
      stck_mxpr: '93600',
      stck_llam: '50400'
    }))
  } as unknown as KisRestClient;
}

describe('StockMasterSync', () => {
  it('종목코드 포맷을 검증한다', () => {
    const master = new StockMasterSync(makeMockClient());

    assert.equal(master.isValidStock('005930'), true);
    assert.equal(master.isValidStock('000660'), true);
    assert.equal(master.isValidStock('12345'), false); // 5자리
    assert.equal(master.isValidStock('1234567'), false); // 7자리
    assert.equal(master.isValidStock('ABCDEF'), false); // 문자
    assert.equal(master.isValidStock(''), false); // 빈 문자열
  });

  it('종목 정보를 조회한다', async () => {
    const master = new StockMasterSync(makeMockClient());
    const info = await master.getStockInfo('005930');

    assert.equal(info.stockCode, '005930');
    assert.equal(info.price, 72000);
    assert.equal(info.volume, 15000000);
  });

  it('캐시된 정보를 반환한다 (API 재호출 없음)', async () => {
    const client = makeMockClient();
    const master = new StockMasterSync(client);

    await master.getStockInfo('005930');
    await master.getStockInfo('005930');

    const fn = (
      client as unknown as { getCurrentPrice: ReturnType<typeof mock.fn> }
    ).getCurrentPrice;
    assert.equal(fn.mock.callCount(), 1);
  });

  it('clearCache 후 API를 다시 호출한다', async () => {
    const client = makeMockClient();
    const master = new StockMasterSync(client);

    await master.getStockInfo('005930');
    master.clearCache();
    await master.getStockInfo('005930');

    const fn = (
      client as unknown as { getCurrentPrice: ReturnType<typeof mock.fn> }
    ).getCurrentPrice;
    assert.equal(fn.mock.callCount(), 2);
  });
});
