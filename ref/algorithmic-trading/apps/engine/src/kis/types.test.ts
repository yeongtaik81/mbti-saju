import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KisTokenResponseSchema,
  KisApprovalResponseSchema,
  KisCurrentPriceResponseSchema,
  KisDailyCandleResponseSchema,
  KisMinuteCandleResponseSchema,
  KisBalanceResponseSchema,
  parseRealtimeTick
} from './types.js';

describe('KIS Zod 스키마', () => {
  it('토큰 응답을 파싱한다', () => {
    const data = {
      access_token: 'eyJ0eXAi...',
      token_type: 'Bearer',
      expires_in: 86400
    };
    const result = KisTokenResponseSchema.parse(data);
    assert.equal(result.access_token, 'eyJ0eXAi...');
    assert.equal(result.expires_in, 86400);
  });

  it('approval key 응답을 파싱한다', () => {
    const data = { approval_key: 'abc123' };
    const result = KisApprovalResponseSchema.parse(data);
    assert.equal(result.approval_key, 'abc123');
  });

  it('현재가 응답을 파싱한다', () => {
    const data = {
      rt_cd: '0',
      msg_cd: 'MCA00000',
      msg1: '정상',
      output: {
        stck_prpr: '72000',
        stck_oprc: '71500',
        stck_hgpr: '72500',
        stck_lwpr: '71000',
        acml_vol: '15000000',
        acml_tr_pbmn: '1080000000000',
        hts_avls: '430000000000000',
        stck_mxpr: '93600',
        stck_llam: '50400'
      }
    };
    const result = KisCurrentPriceResponseSchema.parse(data);
    assert.equal(result.output.stck_prpr, '72000');
    assert.equal(result.rt_cd, '0');
  });

  it('일봉 응답을 파싱한다', () => {
    const data = {
      rt_cd: '0',
      msg_cd: 'MCA00000',
      msg1: '정상',
      output2: [
        {
          stck_bsop_date: '20260301',
          stck_oprc: '71500',
          stck_hgpr: '72500',
          stck_lwpr: '71000',
          stck_clpr: '72000',
          acml_vol: '15000000',
          acml_tr_pbmn: '1080000000000'
        }
      ]
    };
    const result = KisDailyCandleResponseSchema.parse(data);
    assert.equal(result.output2.length, 1);
    assert.equal(result.output2[0]!.stck_bsop_date, '20260301');
  });

  it('분봉 응답을 파싱한다', () => {
    const data = {
      rt_cd: '0',
      msg_cd: 'MCA00000',
      msg1: '정상',
      output2: [
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
    };
    const result = KisMinuteCandleResponseSchema.parse(data);
    assert.equal(result.output2.length, 1);
    assert.equal(result.output2[0]!.stck_cntg_hour, '093000');
  });

  it('잔고 응답을 파싱한다', () => {
    const data = {
      rt_cd: '0',
      msg_cd: 'MCA00000',
      msg1: '정상',
      output1: [
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
      ],
      output2: [
        {
          dnca_tot_amt: '10000000',
          tot_evlu_amt: '17200000',
          pchs_amt_smtl_amt: '7000000',
          evlu_amt_smtl_amt: '7200000',
          evlu_pfls_smtl_amt: '200000'
        }
      ]
    };
    const result = KisBalanceResponseSchema.parse(data);
    assert.equal(result.output1.length, 1);
    assert.equal(result.output1[0]!.pdno, '005930');
    assert.equal(result.output2[0]!.dnca_tot_amt, '10000000');
  });

  it('잘못된 토큰 응답은 에러를 던진다', () => {
    assert.throws(() => KisTokenResponseSchema.parse({ invalid: true }));
  });
});

describe('parseRealtimeTick', () => {
  it('실시간 체결 데이터를 파싱한다', () => {
    // 필드: 종목코드^시간^현재가^전일대비부호^전일대비^등락율^...^체결거래량^누적거래량^누적거래대금
    const fields = new Array(15).fill('0');
    fields[0] = '005930'; // stockCode
    fields[1] = '093015'; // time
    fields[2] = '72000'; // price
    fields[4] = '500'; // change
    fields[5] = '0.70'; // changeRate
    fields[12] = '100'; // volume
    fields[13] = '5000000'; // acmlVolume
    fields[14] = '360000000000'; // acmlAmount

    const raw = `0|H0STCNT0|1|${fields.join('^')}`;
    const tick = parseRealtimeTick(raw);

    assert.ok(tick);
    assert.equal(tick.stockCode, '005930');
    assert.equal(tick.time, '093015');
    assert.equal(tick.price, 72000);
    assert.equal(tick.change, 500);
    assert.equal(tick.changeRate, 0.7);
    assert.equal(tick.volume, 100);
    assert.equal(tick.acmlVolume, 5000000);
  });

  it('잘못된 형식이면 null을 반환한다', () => {
    assert.equal(parseRealtimeTick('invalid'), null);
    assert.equal(parseRealtimeTick('0|H0STCNT0|1|a^b'), null);
  });
});
