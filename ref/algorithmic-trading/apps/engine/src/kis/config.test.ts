import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadKisConfig, getTrIdMap, KisEnv } from './config.js';

describe('loadKisConfig', () => {
  const virtualEnv = {
    KIS_ENV: 'virtual',
    KIS_VIRTUAL_APP_KEY: 'test-vkey',
    KIS_VIRTUAL_APP_SECRET: 'test-vsecret',
    KIS_VIRTUAL_ACCOUNT_NO: '5017235001'
  };

  const prodEnv = {
    KIS_ENV: 'production',
    KIS_PROD_APP_KEY: 'test-pkey',
    KIS_PROD_APP_SECRET: 'test-psecret',
    KIS_PROD_ACCOUNT_NO: '4416722801'
  };

  it('virtual 환경 설정을 올바르게 로드한다', () => {
    const config = loadKisConfig(virtualEnv);

    assert.equal(config.env, 'virtual');
    assert.equal(config.appKey, 'test-vkey');
    assert.equal(config.appSecret, 'test-vsecret');
    assert.equal(config.accountNo, '5017235001');
    assert.equal(config.cano, '50172350');
    assert.equal(config.acntPrdtCd, '01');
    assert.equal(
      config.restBaseUrl,
      'https://openapivts.koreainvestment.com:29443'
    );
    assert.equal(config.wsBaseUrl, 'ws://ops.koreainvestment.com:31000');
    assert.equal(
      config.approvalUrl,
      'https://openapivts.koreainvestment.com:29443'
    );
  });

  it('production 환경 설정을 올바르게 로드한다', () => {
    const config = loadKisConfig(prodEnv);

    assert.equal(config.env, 'production');
    assert.equal(config.appKey, 'test-pkey');
    assert.equal(
      config.restBaseUrl,
      'https://openapi.koreainvestment.com:9443'
    );
    assert.equal(config.wsBaseUrl, 'ws://ops.koreainvestment.com:21000');
    assert.equal(
      config.approvalUrl,
      'https://openapi.koreainvestment.com:9443'
    );
  });

  it('계좌번호에서 CANO와 ACNT_PRDT_CD를 분리한다', () => {
    const config = loadKisConfig(virtualEnv);
    assert.equal(config.cano, '50172350');
    assert.equal(config.acntPrdtCd, '01');
  });

  it('계좌번호가 8자리일 때 ACNT_PRDT_CD 기본값 "01"을 사용한다', () => {
    const env = { ...virtualEnv, KIS_VIRTUAL_ACCOUNT_NO: '50172350' };
    const config = loadKisConfig(env);
    assert.equal(config.cano, '50172350');
    assert.equal(config.acntPrdtCd, '01');
  });

  it('KIS_ENV 미설정 시 기본값 virtual을 사용한다', () => {
    const env = { ...virtualEnv };
    delete (env as Record<string, string | undefined>).KIS_ENV;
    const config = loadKisConfig(env);
    assert.equal(config.env, 'virtual');
  });

  it('필수 환경변수 누락 시 에러를 던진다', () => {
    assert.throws(
      () => loadKisConfig({ KIS_ENV: 'virtual' }),
      /KIS_VIRTUAL_APP_KEY is required/
    );
    assert.throws(
      () =>
        loadKisConfig({
          KIS_ENV: 'virtual',
          KIS_VIRTUAL_APP_KEY: 'key'
        }),
      /KIS_VIRTUAL_APP_SECRET is required/
    );
    assert.throws(
      () =>
        loadKisConfig({
          KIS_ENV: 'virtual',
          KIS_VIRTUAL_APP_KEY: 'key',
          KIS_VIRTUAL_APP_SECRET: 'secret'
        }),
      /KIS_VIRTUAL_ACCOUNT_NO is required/
    );
  });

  it('계좌번호가 8자리 미만이면 에러를 던진다', () => {
    const env = { ...virtualEnv, KIS_VIRTUAL_ACCOUNT_NO: '1234567' };
    assert.throws(() => loadKisConfig(env));
  });
});

describe('getTrIdMap', () => {
  it('virtual 환경 TR_ID를 반환한다', () => {
    const map = getTrIdMap(KisEnv.VIRTUAL);
    assert.equal(map.cashBuy, 'VTTC0802U');
    assert.equal(map.cashSell, 'VTTC0801U');
    assert.equal(map.balanceInquiry, 'VTTC8434R');
    assert.equal(map.currentPrice, 'FHKST01010100');
    assert.equal(map.dailyCandle, 'FHKST03010100');
    assert.equal(map.minuteCandle, 'FHKST03010200');
  });

  it('production 환경 TR_ID를 반환한다', () => {
    const map = getTrIdMap(KisEnv.PRODUCTION);
    assert.equal(map.cashBuy, 'TTTC0802U');
    assert.equal(map.cashSell, 'TTTC0801U');
    assert.equal(map.balanceInquiry, 'TTTC8434R');
  });

  it('시세 조회 TR_ID는 환경에 무관하게 동일하다', () => {
    const vMap = getTrIdMap(KisEnv.VIRTUAL);
    const pMap = getTrIdMap(KisEnv.PRODUCTION);
    assert.equal(vMap.currentPrice, pMap.currentPrice);
    assert.equal(vMap.dailyCandle, pMap.dailyCandle);
    assert.equal(vMap.minuteCandle, pMap.minuteCandle);
  });
});
