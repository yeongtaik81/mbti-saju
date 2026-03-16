import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { KisRestClient } from './rest-client.js';
import { KisAuth } from './auth.js';
import { TokenBucketThrottler } from './throttler.js';
import { KisApiError } from './errors.js';
import type { KisConfig } from './config.js';

function makeConfig(): KisConfig {
  return {
    env: 'virtual',
    appKey: 'test-key',
    appSecret: 'test-secret',
    accountNo: '5017235001',
    cano: '50172350',
    acntPrdtCd: '01',
    restBaseUrl: 'https://test.koreainvestment.com',
    wsBaseUrl: 'ws://test.koreainvestment.com:31000',
    approvalUrl: 'https://test.koreainvestment.com'
  };
}

function makeAuth(): KisAuth {
  const config = makeConfig();
  const fetchFn = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      access_token: 'mock-token',
      token_type: 'Bearer',
      expires_in: 86400
    })
  })) as unknown as typeof globalThis.fetch;
  return new KisAuth(config, fetchFn);
}

describe('KisRestClient', () => {
  it('현재가를 조회한다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    const fetchFn = mock.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
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
      })
    })) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    const price = await client.getCurrentPrice('005930');

    assert.equal(price.stck_prpr, '72000');
    assert.equal(price.acml_vol, '15000000');
    auth.destroy();
  });

  it('rt_cd가 0이 아니면 KisApiError를 던진다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    const fetchFn = mock.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        rt_cd: '1',
        msg_cd: 'EGW00123',
        msg1: '잘못된 종목코드'
      })
    })) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    await assert.rejects(
      () => client.getCurrentPrice('INVALID'),
      (err: unknown) => {
        assert.ok(err instanceof KisApiError);
        assert.equal(err.msgCd, 'EGW00123');
        return true;
      }
    );
    auth.destroy();
  });

  it('일봉 데이터를 조회한다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    const fetchFn = mock.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
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
      })
    })) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    const candles = await client.getDailyCandles(
      '005930',
      '20260201',
      '20260301'
    );

    assert.equal(candles.length, 1);
    assert.equal(candles[0]!.stck_bsop_date, '20260301');
    auth.destroy();
  });
});
