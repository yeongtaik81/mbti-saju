/**
 * Token Bucket 방식 Rate Limiter
 * KIS API: 초당 20회 제한
 */
export class TokenBucketThrottler {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private lastRefill: number;
  private readonly queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  /** 큐 최대 크기 */
  private static readonly MAX_QUEUE_SIZE = 100;
  /** acquire 타임아웃 (ms) */
  private static readonly ACQUIRE_TIMEOUT_MS = 30_000;

  constructor(ratePerSecond = 20) {
    this.maxTokens = ratePerSecond;
    this.tokens = ratePerSecond;
    this.refillRate = ratePerSecond / 1000;
    this.lastRefill = Date.now();
  }

  /** 토큰 리필 */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }

  /** 현재 가용 토큰 수 */
  available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /** 토큰 획득 (없으면 큐에서 대기) */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    if (this.queue.length >= TokenBucketThrottler.MAX_QUEUE_SIZE) {
      throw new Error('Throttler queue full');
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((item) => item.resolve === resolve);
        if (idx !== -1) this.queue.splice(idx, 1);
        reject(new Error('Throttler acquire timeout'));
      }, TokenBucketThrottler.ACQUIRE_TIMEOUT_MS);

      this.queue.push({ resolve, reject, timer });
      this.scheduleDequeue();
    });
  }

  /** 큐 처리 스케줄링 */
  private scheduleDequeue(): void {
    if (this.queue.length === 0) return;

    const waitMs = Math.ceil(1 / this.refillRate);
    setTimeout(() => {
      this.refill();
      while (this.queue.length > 0 && this.tokens >= 1) {
        const item = this.queue.shift()!;
        clearTimeout(item.timer);
        this.tokens -= 1;
        item.resolve();
      }
      if (this.queue.length > 0) {
        this.scheduleDequeue();
      }
    }, waitMs);
  }

  /** 정리: 큐의 모든 대기 항목 reject + 타이머 정리 */
  destroy(): void {
    for (const item of this.queue) {
      clearTimeout(item.timer);
      item.reject(new Error('Throttler destroyed'));
    }
    this.queue.length = 0;
  }
}
