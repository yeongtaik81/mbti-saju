import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toCandle, toMinuteCandle, toPosition } from './mappers.js';
import type {
  KisDailyCandleItem,
  KisMinuteCandleItem,
  KisBalanceItem
} from './types.js';

describe('toCandle', () => {
  it('KIS 일봉 데이터를 도메인 Candle로 변환한다', () => {
    const item: KisDailyCandleItem = {
      stck_bsop_date: '20260301',
      stck_oprc: '71500',
      stck_hgpr: '72500',
      stck_lwpr: '71000',
      stck_clpr: '72000',
      acml_vol: '15000000',
      acml_tr_pbmn: '1080000000000'
    };

    const candle = toCandle(item, '005930');

    assert.equal(candle.stockCode, '005930');
    assert.equal(candle.date, '2026-03-01');
    assert.equal(candle.open, 71500);
    assert.equal(candle.high, 72500);
    assert.equal(candle.low, 71000);
    assert.equal(candle.close, 72000);
    assert.equal(candle.volume, 15000000);
    assert.equal(candle.amount, 1080000000000);
  });
});

describe('toMinuteCandle', () => {
  it('KIS 분봉 데이터를 도메인 MinuteCandle로 변환한다', () => {
    const item: KisMinuteCandleItem = {
      stck_bsop_date: '20260301',
      stck_cntg_hour: '093000',
      stck_oprc: '71500',
      stck_hgpr: '72500',
      stck_lwpr: '71000',
      stck_prpr: '72000',
      cntg_vol: '5000'
    };

    const candle = toMinuteCandle(item, '005930');

    assert.equal(candle.stockCode, '005930');
    assert.equal(candle.datetime, '2026-03-01 09:30');
    assert.equal(candle.open, 71500);
    assert.equal(candle.high, 72500);
    assert.equal(candle.low, 71000);
    assert.equal(candle.close, 72000);
    assert.equal(candle.volume, 5000);
  });
});

describe('toPosition', () => {
  it('KIS 잔고 데이터를 Position으로 변환한다', () => {
    const item: KisBalanceItem = {
      pdno: '005930',
      prdt_name: '삼성전자',
      hldg_qty: '100',
      pchs_avg_pric: '70000.5',
      prpr: '72000',
      evlu_pfls_amt: '199950',
      evlu_pfls_rt: '2.86',
      evlu_amt: '7200000'
    };

    const pos = toPosition(item);

    assert.equal(pos.stockCode, '005930');
    assert.equal(pos.stockName, '삼성전자');
    assert.equal(pos.quantity, 100);
    assert.equal(pos.avgPrice, 70000.5);
    assert.equal(pos.currentPrice, 72000);
    assert.equal(pos.evalAmount, 7200000);
    assert.equal(pos.evalPnl, 199950);
    assert.equal(pos.evalPnlRate, 2.86);
  });
});
