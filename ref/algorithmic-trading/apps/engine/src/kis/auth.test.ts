import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { KisAuth } from './auth.js';
import type { KisConfig } from './config.js';

function makeConfig(overrides?: Partial<KisConfig>): KisConfig {
  return {
    env: 'virtual',
    appKey: 'test-key',
    appSecret: 'test-secret',
    accountNo: '5017235001',
    cano: '50172350',
    acntPrdtCd: '01',
    restBaseUrl: 'https://test.koreainvestment.com',
    wsBaseUrl: 'ws://test.koreainvestment.com:31000',
    approvalUrl: 'https://test.koreainvestment.com',
    ...overrides
  };
}

function mockFetch(body: unknown, status = 200) {
  return mock.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  })) as unknown as typeof globalThis.fetch;
}

describe('KisAuth', () => {
  let config: KisConfig;

  beforeEach(() => {
    config = makeConfig();
  });

  it('토큰을 발급한다', async () => {
    const fetchFn = mockFetch({
      access_token: 'test-token-123',
      token_type: 'Bearer',
      expires_in: 86400
    });

    const auth = new KisAuth(config, fetchFn);
    const token = await auth.issueToken();

    assert.equal(token, 'test-token-123');
    assert.equal(auth.isTokenValid(), true);
    auth.destroy();
  });

  it('getToken은 유효 토큰이 있으면 재발급하지 않는다', async () => {
    const fetchFn = mockFetch({
      access_token: 'test-token',
      token_type: 'Bearer',
      expires_in: 86400
    });

    const auth = new KisAuth(config, fetchFn);
    await auth.issueToken();
    const token = await auth.getToken();

    assert.equal(token, 'test-token');
    assert.equal(
      (fetchFn as unknown as ReturnType<typeof mock.fn>).mock.callCount(),
      1
    );
    auth.destroy();
  });

  it('60초 이내 재발급 시 에러를 던진다', async () => {
    const fetchFn = mockFetch({
      access_token: 'test-token',
      token_type: 'Bearer',
      expires_in: 86400
    });

    const auth = new KisAuth(config, fetchFn);
    await auth.issueToken();

    await assert.rejects(() => auth.issueToken(), /Token reissue too fast/);
    auth.destroy();
  });

  it('발급 실패 시 지수 백오프로 재시도한다', async () => {
    let callCount = 0;
    const fetchFn = mock.fn(async () => {
      callCount++;
      if (callCount < 3) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'recovered',
          token_type: 'Bearer',
          expires_in: 86400
        })
      };
    }) as unknown as typeof globalThis.fetch;

    const auth = new KisAuth(config, fetchFn);
    const token = await auth.issueToken();

    assert.equal(token, 'recovered');
    assert.equal(callCount, 3);
    auth.destroy();
  });

  it('3회 재시도 후 실패하면 에러를 던진다', async () => {
    const fetchFn = mockFetch({}, 500);

    const auth = new KisAuth(config, fetchFn);
    await assert.rejects(() => auth.issueToken(), /Token issue failed/);
    auth.destroy();
  });

  it('approval key를 발급한다', async () => {
    const fetchFn = mockFetch({ approval_key: 'ws-key-123' });

    const auth = new KisAuth(config, fetchFn);
    const key = await auth.issueApprovalKey();

    assert.equal(key, 'ws-key-123');
    auth.destroy();
  });

  it('approval key 발급 실패 시 에러를 던진다', async () => {
    const fetchFn = mockFetch({}, 401);

    const auth = new KisAuth(config, fetchFn);
    await assert.rejects(
      () => auth.issueApprovalKey(),
      /Approval key issue failed/
    );
    auth.destroy();
  });

  it('destroy 후 토큰이 무효하다', async () => {
    const fetchFn = mockFetch({
      access_token: 'test-token',
      token_type: 'Bearer',
      expires_in: 86400
    });

    const auth = new KisAuth(config, fetchFn);
    await auth.issueToken();
    assert.equal(auth.isTokenValid(), true);

    auth.destroy();
    assert.equal(auth.isTokenValid(), false);
  });
});
