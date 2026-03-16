import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KisWsClient } from './ws-client.js';
import { KisWsError } from './errors.js';

describe('KisWsClient', () => {
  it('인스턴스를 생성한다', () => {
    const client = new KisWsClient('ws://test:31000', 'approval-key');
    assert.ok(client);
    client.destroy();
  });

  it('구독을 추가/제거한다', () => {
    const client = new KisWsClient('ws://test:31000', 'approval-key');

    client.subscribe('005930');
    client.subscribe('000660');
    assert.deepEqual(client.getSubscriptions().sort(), ['000660', '005930']);

    client.unsubscribe('005930');
    assert.deepEqual(client.getSubscriptions(), ['000660']);

    client.destroy();
  });

  it('40종목 상한을 초과하면 에러를 던진다', () => {
    const client = new KisWsClient('ws://test:31000', 'approval-key');

    for (let i = 0; i < 40; i++) {
      client.subscribe(String(i).padStart(6, '0'));
    }

    assert.throws(
      () => client.subscribe('999999'),
      (err: unknown) =>
        err instanceof KisWsError && /Max subscriptions/.test(err.message)
    );

    client.destroy();
  });

  it('replaceSubscriptions로 diff 기반 교체한다', () => {
    const client = new KisWsClient('ws://test:31000', 'approval-key');

    client.subscribe('005930');
    client.subscribe('000660');
    client.subscribe('035720');

    client.replaceSubscriptions(['005930', '051910', '035720']);

    const subs = client.getSubscriptions().sort();
    assert.deepEqual(subs, ['005930', '035720', '051910']);

    client.destroy();
  });

  it('이미 구독 중인 종목은 중복 추가되지 않는다', () => {
    const client = new KisWsClient('ws://test:31000', 'approval-key');

    client.subscribe('005930');
    client.subscribe('005930');
    assert.equal(client.getSubscriptions().length, 1);

    client.destroy();
  });

  it('destroy 후 구독이 비어진다', () => {
    const client = new KisWsClient('ws://test:31000', 'approval-key');
    client.subscribe('005930');
    client.destroy();
    assert.equal(client.getSubscriptions().length, 0);
  });
});
