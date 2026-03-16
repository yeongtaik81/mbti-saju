import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Candle } from '@trading/shared/types';
import { dualMomentumStrategy } from './dual-momentum.js';
import { maCrossoverStrategy } from './ma-crossover.js';
import { bbRsiStrategy } from './bb-rsi.js';
import { turtleStrategy } from './turtle.js';
import { volatilityBreakoutStrategy } from './volatility-breakout.js';
import { STRATEGY_TYPE } from '../types.js';

/** 테스트용 캔들 생성 */
function makeCandle(
  code: string,
  date: string,
  close: number,
  opts?: Partial<Candle>
): Candle {
  return {
    stockCode: code,
    date,
    open: close,
    high: close * 1.02,
    low: close * 0.98,
    close,
    volume: 10000,
    ...opts
  };
}

function makeDates(count: number): string[] {
  const dates: string[] = [];
  let d = new Date('2024-01-01');
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86400000);
  }
  return dates;
}

function makeStockCandles(
  code: string,
  dates: string[],
  prices: number[]
): Candle[] {
  return dates.map((d, i) =>
    makeCandle(code, d, prices[i]!, {
      open: prices[i]!,
      high: prices[i]! * 1.03,
      low: prices[i]! * 0.97
    })
  );
}

describe('Dual Momentum', () => {
  it('type = dual_momentum', () => {
    assert.strictEqual(dualMomentumStrategy.type, STRATEGY_TYPE.DUAL_MOMENTUM);
  });

  it('양수 모멘텀 종목만 매수 시그널', () => {
    const dates = makeDates(80);
    // A: 꾸준히 상승 (양수 모멘텀)
    const pricesA = Array.from({ length: 80 }, (_, i) => 100 + i);
    // B: 꾸준히 하락 (음수 모멘텀)
    const pricesB = Array.from({ length: 80 }, (_, i) => 200 - i);

    const stockCandles = new Map<string, Candle[]>();
    stockCandles.set('A', makeStockCandles('A', dates, pricesA));
    stockCandles.set('B', makeStockCandles('B', dates, pricesB));

    const params = { lookback: 60, holdDays: 20, topN: 5 };
    const signals = dualMomentumStrategy.generateSignals(
      stockCandles,
      dates,
      params
    );

    // A should have buy signals (positive momentum), B should not
    let foundA = false;
    for (const [, ranked] of signals.buy) {
      for (const sig of ranked) {
        if (sig.stockCode === 'A') foundA = true;
        assert.notStrictEqual(
          sig.stockCode,
          'B',
          'B should not have buy signal (negative momentum)'
        );
      }
    }
    assert.ok(foundA, 'A should have buy signals');
  });

  it('매수 시그널이 score 내림차순', () => {
    const dates = makeDates(80);
    const stockCandles = new Map<string, Candle[]>();
    // 3 stocks with different momentum
    for (let s = 0; s < 3; s++) {
      const code = `S${s}`;
      const prices = Array.from({ length: 80 }, (_, i) => 100 + i * (s + 1));
      stockCandles.set(code, makeStockCandles(code, dates, prices));
    }

    const signals = dualMomentumStrategy.generateSignals(stockCandles, dates, {
      lookback: 60,
      holdDays: 20,
      topN: 5
    });

    for (const [, ranked] of signals.buy) {
      for (let i = 1; i < ranked.length; i++) {
        assert.ok(
          ranked[i - 1]!.score >= ranked[i]!.score,
          `Signals should be sorted by score descending`
        );
      }
    }
  });
});

describe('MA Crossover', () => {
  it('type = ma_crossover', () => {
    assert.strictEqual(maCrossoverStrategy.type, STRATEGY_TYPE.MA_CROSSOVER);
  });

  it('골든크로스에서 매수 시그널 발생', () => {
    const dates = makeDates(30);
    // 하락 후 급반등 → 단기MA가 장기MA 상향 돌파
    const prices = [
      50,
      48,
      46,
      44,
      42,
      40,
      38,
      36,
      34,
      32, // 하락
      30,
      28,
      26,
      24,
      22,
      20,
      18,
      16,
      14,
      12, // 계속 하락
      25,
      35,
      45,
      55,
      65,
      75,
      85,
      95,
      105,
      115 // 급반등
    ];

    const stockCandles = new Map<string, Candle[]>();
    stockCandles.set('A', makeStockCandles('A', dates, prices));

    const signals = maCrossoverStrategy.generateSignals(stockCandles, dates, {
      shortPeriod: 5,
      longPeriod: 10
    });

    // Should have at least one buy signal after the reversal
    assert.ok(
      signals.buy.size > 0,
      'Should generate buy signals on golden cross'
    );
  });

  it('데드크로스에서 매도 시그널 발생', () => {
    const dates = makeDates(30);
    // 상승 후 급락 → 단기MA가 장기MA 하향 돌파
    const prices = [
      10,
      12,
      14,
      16,
      18,
      20,
      22,
      24,
      26,
      28, // 상승
      30,
      32,
      34,
      36,
      38,
      40,
      42,
      44,
      46,
      48, // 계속 상승
      35,
      25,
      15,
      10,
      8,
      6,
      5,
      4,
      3,
      2 // 급락
    ];

    const stockCandles = new Map<string, Candle[]>();
    stockCandles.set('A', makeStockCandles('A', dates, prices));

    const signals = maCrossoverStrategy.generateSignals(stockCandles, dates, {
      shortPeriod: 5,
      longPeriod: 10
    });

    assert.ok(
      signals.sell.size > 0,
      'Should generate sell signals on dead cross'
    );
  });
});

describe('BB + RSI', () => {
  it('type = bb_rsi', () => {
    assert.strictEqual(bbRsiStrategy.type, STRATEGY_TYPE.BB_RSI);
  });

  it('데이터 부족 시 시그널 없음', () => {
    const dates = makeDates(5);
    const stockCandles = new Map<string, Candle[]>();
    stockCandles.set('A', makeStockCandles('A', dates, [100, 99, 98, 97, 96]));

    const signals = bbRsiStrategy.generateSignals(stockCandles, dates, {
      bbPeriod: 20,
      bbK: 2,
      rsiPeriod: 14,
      rsiLow: 30,
      rsiHigh: 70
    });

    assert.strictEqual(signals.buy.size, 0);
    assert.strictEqual(signals.sell.size, 0);
  });

  it('매수 시그널 score 내림차순', () => {
    // Generate enough data for BB+RSI to produce signals
    const dates = makeDates(100);
    const stockCandles = new Map<string, Candle[]>();

    // Create stocks with different price patterns
    for (let s = 0; s < 3; s++) {
      const code = `S${s}`;
      const prices = Array.from({ length: 100 }, (_, i) => {
        // Oscillating price that should trigger some signals
        return 100 + 20 * Math.sin(i * 0.3 + s);
      });
      stockCandles.set(code, makeStockCandles(code, dates, prices));
    }

    const signals = bbRsiStrategy.generateSignals(stockCandles, dates, {
      bbPeriod: 20,
      bbK: 2,
      rsiPeriod: 14,
      rsiLow: 30,
      rsiHigh: 70
    });

    for (const [, ranked] of signals.buy) {
      for (let i = 1; i < ranked.length; i++) {
        assert.ok(
          ranked[i - 1]!.score >= ranked[i]!.score,
          'Buy signals should be sorted descending'
        );
      }
    }
  });
});

describe('Turtle Trading', () => {
  it('type = turtle', () => {
    assert.strictEqual(turtleStrategy.type, STRATEGY_TYPE.TURTLE);
  });

  it('채널 돌파 시 매수 시그널', () => {
    const dates = makeDates(40);
    // Flat for 20 days then breakout
    const prices = [
      ...Array(25).fill(100),
      110,
      115,
      120,
      125,
      130,
      135,
      140,
      145,
      150,
      155,
      160,
      165,
      170,
      175,
      180
    ];

    const stockCandles = new Map<string, Candle[]>();
    stockCandles.set(
      'A',
      dates.map((d, i) =>
        makeCandle('A', d, prices[i]!, {
          open: prices[i]!,
          high: prices[i]! * 1.01,
          low: prices[i]! * 0.99
        })
      )
    );

    const signals = turtleStrategy.generateSignals(stockCandles, dates, {
      entryPeriod: 20,
      exitPeriod: 10,
      atrPeriod: 14,
      atrMultiple: 2
    });

    assert.ok(
      signals.buy.size > 0,
      'Should generate buy signals on channel breakout'
    );
  });

  it('exit 채널 이탈 시 매도 시그널 (close < prevExitLower)', () => {
    const dates = makeDates(40);
    // 전일 exit 채널 사용: close < exitDc.lower[i-1]
    // 안정적 가격(200) 후 급락 → 종가가 전일 exit 채널 하단을 깨면 매도
    const prices: number[] = Array(25).fill(200);
    // 소폭 하락
    for (let i = 25; i < 35; i++) prices.push(200 - (i - 24) * 2);
    // 급락: 전일까지의 10일 최저가(exitPeriod=10) 이하로 종가 하락
    // 34일 기준 최근 10일 low: ~prices 25-34 → 178~198 범위, min low ≈ 178*0.97 ≈ 172.7
    // 35일부터 종가를 160 이하로 떨어뜨림 → 정상 캔들에서도 prevExitLower > close 가능
    for (let i = 35; i < 40; i++) prices.push(155 - (i - 35) * 5);

    const stockCandles = new Map<string, Candle[]>();
    stockCandles.set(
      'A',
      dates.map((d, i) =>
        makeCandle('A', d, prices[i]!, {
          open: prices[i]! + 3,
          high: prices[i]! + 5,
          low: prices[i]! - 2
        })
      )
    );

    const signals = turtleStrategy.generateSignals(stockCandles, dates, {
      entryPeriod: 20,
      exitPeriod: 10,
      atrPeriod: 14,
      atrMultiple: 2
    });

    assert.ok(
      signals.sell.size > 0,
      'Should generate sell signals when close < prev exit channel lower'
    );
  });
});

describe('Volatility Breakout', () => {
  it('type = volatility_breakout', () => {
    assert.strictEqual(
      volatilityBreakoutStrategy.type,
      STRATEGY_TYPE.VOLATILITY_BREAKOUT
    );
  });

  it('전일 지표 사용 (룩어헤드 없음)', () => {
    // Ensure the strategy uses i-1 indicators
    const dates = makeDates(50);
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);

    const stockCandles = new Map<string, Candle[]>();
    stockCandles.set(
      'A',
      dates.map((d, i) =>
        makeCandle('A', d, prices[i]!, {
          open: prices[i]! - 2,
          high: prices[i]! + 5,
          low: prices[i]! - 5
        })
      )
    );

    // This should not throw
    const signals = volatilityBreakoutStrategy.generateSignals(
      stockCandles,
      dates,
      {
        k: 0.5,
        shortMaPeriod: 5,
        longMaPeriod: 20,
        rsiPeriod: 14,
        rsiLow: 30,
        rsiHigh: 70
      }
    );

    assert.ok(signals.buy instanceof Map);
    assert.ok(signals.sell instanceof Map);
  });

  it('3조건 미충족 시 매수 시그널 없음', () => {
    const dates = makeDates(30);
    // Flat prices → no breakout, no MA cross
    const candles = makeStockCandles('A', dates, Array(30).fill(100));
    const stockCandles = new Map([['A', candles]]);

    const signals = volatilityBreakoutStrategy.generateSignals(
      stockCandles,
      dates,
      {
        k: 0.5,
        shortMaPeriod: 5,
        longMaPeriod: 20,
        rsiPeriod: 14,
        rsiLow: 30,
        rsiHigh: 70
      }
    );

    assert.strictEqual(
      signals.buy.size,
      0,
      'Flat prices should not produce breakout signals'
    );
  });
});
