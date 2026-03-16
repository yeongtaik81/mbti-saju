import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toExecution } from './mappers.js';
import type { KisExecutionItem } from './types.js';

describe('toExecution', () => {
  it('매수 체결을 도메인 타입으로 변환한다', () => {
    const item: KisExecutionItem = {
      odno: '0000012345',
      orgn_odno: '',
      pdno: '005930',
      sll_buy_dvsn_cd: '02', // 매수
      ord_qty: '10',
      tot_ccld_qty: '10',
      tot_ccld_amt: '720000',
      pchs_avg_pric: '72000',
      ord_unpr: '72000',
      ord_tmd: '100530'
    };

    const result = toExecution(item);
    assert.equal(result.kisOrderNo, '0000012345');
    assert.equal(result.stockCode, '005930');
    assert.equal(result.side, 'buy');
    assert.equal(result.filledQuantity, 10);
    assert.equal(result.filledAmount, 720000);
    assert.equal(result.avgPrice, 72000);
  });

  it('매도 체결을 도메인 타입으로 변환한다', () => {
    const item: KisExecutionItem = {
      odno: '0000054321',
      orgn_odno: '0000012345',
      pdno: '000660',
      sll_buy_dvsn_cd: '01', // 매도
      ord_qty: '5',
      tot_ccld_qty: '5',
      tot_ccld_amt: '800000',
      pchs_avg_pric: '160000',
      ord_unpr: '160000',
      ord_tmd: '140000'
    };

    const result = toExecution(item);
    assert.equal(result.side, 'sell');
    assert.equal(result.orgOrderNo, '0000012345');
    assert.equal(result.orderQuantity, 5);
  });
});
