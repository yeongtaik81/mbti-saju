import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sma, ema, rsi, atr } from './indicators.js';
import type { Candle } from '@trading/shared/types';

/** 테스트용 캔들 생성 헬퍼 */
function makeCandle(close: number, opts?: Partial<Candle>): Candle {
  return {
    stockCode: '005930',
    date: '2024-01-01',
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
    ...opts
  };
}

function makeCandles(closes: number[]): Candle[] {
  return closes.map((c, i) =>
    makeCandle(c, { date: `2024-01-${String(i + 1).padStart(2, '0')}` })
  );
}

function approxEqual(
  a: number | null | undefined,
  b: number,
  epsilon = 0.0001
): void {
  assert.notStrictEqual(a, null, `Expected ${b} but got null`);
  assert.ok(
    Math.abs((a as number) - b) < epsilon,
    `Expected ~${b} but got ${a}`
  );
}

describe('SMA', () => {
  it('5일 SMA 정확성', () => {
    const candles = makeCandles([10, 20, 30, 40, 50, 60, 70]);
    const result = sma(candles, 5);

    assert.strictEqual(result[0], null);
    assert.strictEqual(result[3], null);
    approxEqual(result[4], 30); // (10+20+30+40+50)/5
    approxEqual(result[5], 40); // (20+30+40+50+60)/5
    approxEqual(result[6], 50); // (30+40+50+60+70)/5
  });

  it('데이터 부족 시 전부 null', () => {
    const candles = makeCandles([10, 20, 30]);
    const result = sma(candles, 5);
    assert.ok(result.every((v) => v === null));
  });

  it('period = 1일 때 각 종가 반환', () => {
    const candles = makeCandles([10, 20, 30]);
    const result = sma(candles, 1);
    approxEqual(result[0], 10);
    approxEqual(result[1], 20);
    approxEqual(result[2], 30);
  });

  it('빈 배열', () => {
    assert.deepStrictEqual(sma([], 5), []);
  });

  it('period <= 0 시 전부 null', () => {
    const candles = makeCandles([10, 20]);
    const result = sma(candles, 0);
    assert.ok(result.every((v) => v === null));
  });
});

describe('EMA', () => {
  it('seed 값은 SMA', () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = ema(candles, 3);

    // seed at index 2: SMA(10,20,30) = 20
    approxEqual(result[2], 20);
    // null before seed
    assert.strictEqual(result[0], null);
    assert.strictEqual(result[1], null);
  });

  it('EMA 계산 정확성', () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = ema(candles, 3);

    const alpha = 2 / (3 + 1); // 0.5
    // index 2: seed = 20
    // index 3: 20 * 0.5 + 40 * 0.5 = 30
    approxEqual(result[3], 30);
    // index 4: 30 * 0.5 + 50 * 0.5 = 40
    approxEqual(result[4], 40);
  });

  it('데이터 부족 시 전부 null', () => {
    const candles = makeCandles([10, 20]);
    const result = ema(candles, 5);
    assert.ok(result.every((v) => v === null));
  });
});

describe('RSI', () => {
  it('기본 RSI 계산', () => {
    // 14기간 RSI를 위해 15개 데이터 필요
    const prices = [
      44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89,
      46.03, 45.61, 46.28, 46.28
    ];
    const candles = makeCandles(prices);
    const result = rsi(candles, 14);

    // 첫 14개 인덱스(0~13)는 null
    for (let i = 0; i < 14; i++) {
      assert.strictEqual(result[i], null);
    }
    // 인덱스 14에 첫 RSI 값
    assert.notStrictEqual(result[14], null);
    assert.ok((result[14] as number) >= 0 && (result[14] as number) <= 100);
  });

  it('모두 상승 시 RSI = 100', () => {
    const candles = makeCandles([10, 20, 30, 40, 50, 60]);
    const result = rsi(candles, 3);

    // 인덱스 3에 첫 RSI
    approxEqual(result[3], 100);
  });

  it('모두 하락 시 RSI = 0', () => {
    const candles = makeCandles([60, 50, 40, 30, 20, 10]);
    const result = rsi(candles, 3);

    approxEqual(result[3], 0);
  });

  it('데이터 부족 시 전부 null', () => {
    const candles = makeCandles([10, 20, 30]);
    const result = rsi(candles, 5);
    assert.ok(result.every((v) => v === null));
  });

  it('RSI 범위 0~100', () => {
    const prices = [100, 105, 102, 108, 103, 110, 107, 112, 109, 115, 111];
    const candles = makeCandles(prices);
    const result = rsi(candles, 5);

    for (const v of result) {
      if (v !== null) {
        assert.ok(v >= 0 && v <= 100, `RSI ${v} out of range`);
      }
    }
  });
});

describe('ATR', () => {
  it('기본 ATR 계산', () => {
    const candles: Candle[] = [
      {
        stockCode: '005930',
        date: '2024-01-01',
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000
      },
      {
        stockCode: '005930',
        date: '2024-01-02',
        open: 102,
        high: 108,
        low: 98,
        close: 106,
        volume: 1000
      },
      {
        stockCode: '005930',
        date: '2024-01-03',
        open: 106,
        high: 110,
        low: 100,
        close: 104,
        volume: 1000
      },
      {
        stockCode: '005930',
        date: '2024-01-04',
        open: 104,
        high: 112,
        low: 99,
        close: 110,
        volume: 1000
      }
    ];
    const result = atr(candles, 2);

    // TR[0] (index 1): max(108-98, |108-102|, |98-102|) = max(10, 6, 4) = 10
    // TR[1] (index 2): max(110-100, |110-106|, |100-106|) = max(10, 4, 6) = 10
    // ATR at index 2: (10+10)/2 = 10
    approxEqual(result[2], 10);

    // TR[2] (index 3): max(112-99, |112-104|, |99-104|) = max(13, 8, 5) = 13
    // ATR at index 3: (10*(2-1) + 13)/2 = 23/2 = 11.5
    approxEqual(result[3], 11.5);
  });

  it('null 범위 확인', () => {
    const candles: Candle[] = [
      {
        stockCode: '005930',
        date: '2024-01-01',
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000
      },
      {
        stockCode: '005930',
        date: '2024-01-02',
        open: 102,
        high: 108,
        low: 98,
        close: 106,
        volume: 1000
      },
      {
        stockCode: '005930',
        date: '2024-01-03',
        open: 106,
        high: 110,
        low: 100,
        close: 104,
        volume: 1000
      }
    ];
    const result = atr(candles, 2);

    assert.strictEqual(result[0], null);
    assert.strictEqual(result[1], null);
    assert.notStrictEqual(result[2], null);
  });

  it('데이터 부족 시 전부 null', () => {
    const candles = makeCandles([100, 200]);
    const result = atr(candles, 5);
    assert.ok(result.every((v) => v === null));
  });

  it('ATR은 항상 양수', () => {
    const prices = [100, 90, 95, 85, 92, 80, 88, 75];
    const candles = makeCandles(prices);
    const result = atr(candles, 3);

    for (const v of result) {
      if (v !== null) {
        assert.ok(v > 0, `ATR should be positive: ${v}`);
      }
    }
  });
});

describe('adjClose 사용', () => {
  it('adjClose 있으면 adjClose 기준으로 SMA 계산', () => {
    const candles: Candle[] = [
      makeCandle(100, { adjClose: 90 }),
      makeCandle(100, { adjClose: 95 }),
      makeCandle(100, { adjClose: 100 })
    ];
    const result = sma(candles, 3);

    // adjClose 기준: (90+95+100)/3 = 95
    approxEqual(result[2], 95);
  });

  it('adjClose 없으면 close 기준으로 SMA 계산', () => {
    const candles = makeCandles([90, 95, 100]);
    const result = sma(candles, 3);

    approxEqual(result[2], 95);
  });
});
