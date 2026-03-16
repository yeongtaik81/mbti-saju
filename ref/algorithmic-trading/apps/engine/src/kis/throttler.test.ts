import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucketThrottler } from './throttler.js';

describe('TokenBucketThrottler', () => {
  it('초기 토큰 수를 올바르게 설정한다', () => {
    const throttler = new TokenBucketThrottler(20);
    assert.equal(throttler.available(), 20);
  });

  it('acquire 시 토큰을 소비한다', async () => {
    const throttler = new TokenBucketThrottler(5);
    await throttler.acquire();
    assert.equal(throttler.available(), 4);
  });

  it('모든 토큰을 소비할 수 있다', async () => {
    const throttler = new TokenBucketThrottler(3);
    await throttler.acquire();
    await throttler.acquire();
    await throttler.acquire();
    assert.equal(throttler.available(), 0);
  });

  it('토큰 소진 후 대기하면 리필된다', async () => {
    const throttler = new TokenBucketThrottler(20);
    for (let i = 0; i < 5; i++) {
      await throttler.acquire();
    }
    assert.equal(throttler.available(), 15);
  });

  it('큐 초과 시 즉시 reject한다', async () => {
    const throttler = new TokenBucketThrottler(1);
    await throttler.acquire();

    // 큐를 100개 채우되, 각 promise의 에러를 catch하여 unhandledRejection 방지
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 100; i++) {
      promises.push(throttler.acquire().catch(() => {}));
    }

    await assert.rejects(() => throttler.acquire(), /Throttler queue full/);

    // 큐에 있는 promise들이 정리될 때까지 대기
    await Promise.allSettled(promises);
  });
});
