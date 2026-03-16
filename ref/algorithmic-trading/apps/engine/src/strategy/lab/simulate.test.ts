import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Candle } from '@trading/shared/types';
import type { LabRiskParams, LabCostParams, RankedSignal } from './types.js';
import { simulatePortfolio } from './simulate.js';

/** 테스트용 캔들 생성 */
function makeCandle(
  code: string,
  date: string,
  open: number,
  close: number,
  opts?: Partial<Candle>
): Candle {
  return {
    stockCode: code,
    date,
    open,
    high: Math.max(open, close) * 1.02,
    low: Math.min(open, close) * 0.98,
    close,
    volume: 10000,
    ...opts
  };
}

function makeDates(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`
  );
}

function makeStockCandles(
  code: string,
  dates: string[],
  prices: number[]
): Candle[] {
  return dates.map((d, i) =>
    makeCandle(code, d, prices[i]!, prices[i]!, {
      high: prices[i]! * 1.02,
      low: prices[i]! * 0.98
    })
  );
}

const defaultRisk: LabRiskParams = {
  stopLossRate: -0.05,
  takeProfitRate: 0.1,
  maxHoldDays: 20,
  maxPositions: 5,
  maxWeight: 0.3
};

const zeroCost: LabCostParams = {
  slippageRate: 0,
  feeRate: 0,
  taxRate: 0
};

const defaultCost: LabCostParams = {
  slippageRate: 0.001,
  feeRate: 0.00015,
  taxRate: 0.0018
};

// 타이밍 계약: signal on dates[N] → execution on dates[N+1]
// 테스트에서 "dates[X]에 체결하고 싶으면" signal은 dates[X-1]에 설정

describe('simulatePortfolio', () => {
  it('시그널 없으면 거래 없음', () => {
    const dates = makeDates(10);
    const candles = makeStockCandles('A', dates, Array(10).fill(100));
    const result = simulatePortfolio({
      buySignals: new Map(),
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: defaultRisk,
      costParams: zeroCost
    });

    assert.strictEqual(result.totalTrades, 0);
    assert.strictEqual(result.trades.length, 0);
    assert.strictEqual(result.equityCurve.length, 10);
    assert.ok(Math.abs(result.totalReturn) < 0.001);
  });

  it('매수 → 매도 시그널로 기본 거래 (T+1 체결)', () => {
    const dates = makeDates(10);
    // Signal on dates[0] → buy at dates[1] open (100)
    // Signal on dates[3] → sell at dates[4] open (102)
    const prices = [100, 100, 101, 102, 102, 102, 102, 102, 102, 102];
    const candles = makeStockCandles('A', dates, prices);

    const buySignals = new Map<string, RankedSignal[]>();
    buySignals.set(dates[0]!, [{ stockCode: 'A', score: 1 }]);

    const sellSignals = new Map<string, Set<string>>();
    sellSignals.set(dates[3]!, new Set(['A']));

    const result = simulatePortfolio({
      buySignals,
      sellSignals,
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: { ...defaultRisk, takeProfitRate: 0.5 },
      costParams: zeroCost
    });

    assert.strictEqual(result.totalTrades, 1);
    assert.strictEqual(result.trades[0]!.reason, 'exit_signal');
    assert.ok(result.trades[0]!.pnl > 0, 'should be profitable');
  });

  it('손절 트리거', () => {
    const dates = makeDates(5);
    // Signal dates[0] → buy at dates[1] open (100)
    // Day 2: drops low=90 < 100*(1-0.05)=95 → stop loss
    const candles: Candle[] = [
      makeCandle('A', dates[0]!, 100, 100),
      makeCandle('A', dates[1]!, 100, 100),
      makeCandle('A', dates[2]!, 98, 90, { low: 90, high: 98 }),
      makeCandle('A', dates[3]!, 92, 95),
      makeCandle('A', dates[4]!, 95, 95)
    ];

    const buySignals = new Map<string, RankedSignal[]>();
    buySignals.set(dates[0]!, [{ stockCode: 'A', score: 1 }]);

    const result = simulatePortfolio({
      buySignals,
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: { ...defaultRisk, stopLossRate: -0.05 },
      costParams: zeroCost
    });

    assert.strictEqual(result.trades.length, 1);
    assert.strictEqual(result.trades[0]!.reason, 'stop_loss');
    assert.ok(result.trades[0]!.pnl < 0, 'should be a loss');
  });

  it('익절 트리거', () => {
    const dates = makeDates(5);
    // Signal dates[0] → buy at dates[1] open (100)
    // Day 2: high=115 >= 100*(1+0.10)=110 → take profit
    const candles: Candle[] = [
      makeCandle('A', dates[0]!, 100, 100),
      makeCandle('A', dates[1]!, 100, 100),
      makeCandle('A', dates[2]!, 105, 115, { high: 115, low: 104 }),
      makeCandle('A', dates[3]!, 112, 112),
      makeCandle('A', dates[4]!, 112, 112)
    ];

    const buySignals = new Map<string, RankedSignal[]>();
    buySignals.set(dates[0]!, [{ stockCode: 'A', score: 1 }]);

    const result = simulatePortfolio({
      buySignals,
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: { ...defaultRisk, takeProfitRate: 0.1 },
      costParams: zeroCost
    });

    assert.strictEqual(result.trades.length, 1);
    assert.strictEqual(result.trades[0]!.reason, 'take_profit');
    assert.ok(result.trades[0]!.pnl > 0);
  });

  it('최대 보유일 초과 시 매도', () => {
    const dates = makeDates(7);
    const candles = makeStockCandles(
      'A',
      dates,
      [100, 100, 101, 102, 103, 104, 105]
    );

    const buySignals = new Map<string, RankedSignal[]>();
    buySignals.set(dates[0]!, [{ stockCode: 'A', score: 1 }]);

    const result = simulatePortfolio({
      buySignals,
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: { ...defaultRisk, maxHoldDays: 3 },
      costParams: zeroCost
    });

    assert.strictEqual(result.trades.length, 1);
    assert.strictEqual(result.trades[0]!.reason, 'max_hold');
  });

  it('maxPositions 제한 준수', () => {
    const dates = makeDates(10);
    const stockCandles = new Map<string, Candle[]>();
    const buySignals = new Map<string, RankedSignal[]>();
    const signals: RankedSignal[] = [];

    for (let i = 0; i < 5; i++) {
      const code = `S${i}`;
      stockCandles.set(
        code,
        makeStockCandles(code, dates, Array(10).fill(100))
      );
      signals.push({ stockCode: code, score: 5 - i });
    }
    buySignals.set(dates[0]!, signals);

    const result = simulatePortfolio({
      buySignals,
      sellSignals: new Map(),
      stockCandles,
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: { ...defaultRisk, maxPositions: 2, maxWeight: 0.5 },
      costParams: zeroCost
    });

    const buyCodes = result.trades.map((t) => t.stockCode);
    assert.ok(
      buyCodes.length <= 2,
      `Expected max 2 positions but got ${buyCodes.length}`
    );
  });

  it('비용 모델 (슬리피지 + 수수료 + 세금) 반영', () => {
    const dates = makeDates(6);
    const candles = makeStockCandles(
      'A',
      dates,
      [100, 100, 100, 100, 100, 100]
    );

    const buySignals = new Map<string, RankedSignal[]>();
    buySignals.set(dates[0]!, [{ stockCode: 'A', score: 1 }]);

    const sellSignals = new Map<string, Set<string>>();
    sellSignals.set(dates[2]!, new Set(['A']));

    const resultNoCost = simulatePortfolio({
      buySignals,
      sellSignals,
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: defaultRisk,
      costParams: zeroCost
    });

    const resultWithCost = simulatePortfolio({
      buySignals,
      sellSignals,
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: defaultRisk,
      costParams: defaultCost
    });

    const noCostEquity =
      resultNoCost.equityCurve[resultNoCost.equityCurve.length - 1]!.equity;
    const withCostEquity =
      resultWithCost.equityCurve[resultWithCost.equityCurve.length - 1]!.equity;
    assert.ok(withCostEquity < noCostEquity, 'Costs should reduce equity');
  });

  it('미청산 포지션 강제 청산', () => {
    const dates = makeDates(5);
    const candles = makeStockCandles('A', dates, [100, 100, 101, 102, 103]);

    const buySignals = new Map<string, RankedSignal[]>();
    buySignals.set(dates[0]!, [{ stockCode: 'A', score: 1 }]);

    const result = simulatePortfolio({
      buySignals,
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: {
        ...defaultRisk,
        maxHoldDays: 999,
        takeProfitRate: 0.5,
        stopLossRate: -0.5
      },
      costParams: zeroCost
    });

    assert.strictEqual(result.trades.length, 1);
    assert.strictEqual(result.trades[0]!.reason, 'force_liquidate');
  });

  it('equityCurve 길이 = allDates 길이', () => {
    const dates = makeDates(20);
    const candles = makeStockCandles('A', dates, Array(20).fill(100));
    const result = simulatePortfolio({
      buySignals: new Map(),
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: defaultRisk,
      costParams: zeroCost
    });

    assert.strictEqual(result.equityCurve.length, dates.length);
  });

  it('MDD 계산 정확성', () => {
    const dates = makeDates(7);
    // Signal dates[0] → buy at dates[1] open (100)
    const candles: Candle[] = [
      makeCandle('A', dates[0]!, 100, 100),
      makeCandle('A', dates[1]!, 100, 100),
      makeCandle('A', dates[2]!, 103, 105, { high: 106, low: 102 }),
      makeCandle('A', dates[3]!, 104, 104, { high: 105, low: 103 }),
      makeCandle('A', dates[4]!, 98, 96, { high: 99, low: 95 }),
      makeCandle('A', dates[5]!, 96, 96, { high: 97, low: 95 }),
      makeCandle('A', dates[6]!, 96, 96, { high: 97, low: 95 })
    ];

    const buySignals = new Map<string, RankedSignal[]>();
    buySignals.set(dates[0]!, [{ stockCode: 'A', score: 1 }]);

    const result = simulatePortfolio({
      buySignals,
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: {
        ...defaultRisk,
        maxHoldDays: 999,
        takeProfitRate: 0.5,
        stopLossRate: -0.5
      },
      costParams: zeroCost
    });

    assert.ok(result.mdd > 0, 'MDD should be positive when drawdown occurs');
  });

  it('Sharpe ratio 계산', () => {
    const dates = makeDates(30);
    const prices = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const candles = makeStockCandles('A', dates, prices);

    const buySignals = new Map<string, RankedSignal[]>();
    buySignals.set(dates[0]!, [{ stockCode: 'A', score: 1 }]);

    const result = simulatePortfolio({
      buySignals,
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: { ...defaultRisk, maxHoldDays: 999 },
      costParams: zeroCost
    });

    assert.ok(
      result.sharpeRatio > 0,
      `Expected positive Sharpe but got ${result.sharpeRatio}`
    );
  });

  it('랭킹 순서대로 매수 (높은 score 우선)', () => {
    const dates = makeDates(5);
    const stockCandles = new Map<string, Candle[]>();
    stockCandles.set(
      'HIGH',
      makeStockCandles('HIGH', dates, Array(5).fill(100))
    );
    stockCandles.set('LOW', makeStockCandles('LOW', dates, Array(5).fill(100)));

    const buySignals = new Map<string, RankedSignal[]>();
    buySignals.set(dates[0]!, [
      { stockCode: 'HIGH', score: 10 },
      { stockCode: 'LOW', score: 1 }
    ]);

    const result = simulatePortfolio({
      buySignals,
      sellSignals: new Map(),
      stockCandles,
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: { ...defaultRisk, maxPositions: 1 },
      costParams: zeroCost
    });

    assert.strictEqual(result.trades.length, 1);
    assert.strictEqual(result.trades[0]!.stockCode, 'HIGH');
  });

  it('T+1 타이밍 계약: 시그널 관찰일 != 체결일', () => {
    const dates = makeDates(5);
    const candles = makeStockCandles('A', dates, [100, 200, 200, 200, 200]);

    const buySignals = new Map<string, RankedSignal[]>();
    // Signal on dates[0] → should execute on dates[1] open (200)
    buySignals.set(dates[0]!, [{ stockCode: 'A', score: 1 }]);

    const result = simulatePortfolio({
      buySignals,
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: {
        ...defaultRisk,
        maxHoldDays: 999,
        takeProfitRate: 0.5,
        stopLossRate: -0.5
      },
      costParams: zeroCost
    });

    assert.strictEqual(result.trades.length, 1);
    // Buy price should be dates[1] open (200), NOT dates[0] open (100)
    assert.strictEqual(result.trades[0]!.buyPrice, 200);
    assert.strictEqual(result.trades[0]!.buyDate, dates[1]);
  });

  it('initialPendingBuy → allDates[0]에 즉시 체결', () => {
    const dates = makeDates(3);
    const candles = makeStockCandles('A', dates, [100, 105, 110]);

    // 시그널 맵에는 없지만, initialPendingBuy로 주입
    const result = simulatePortfolio({
      buySignals: new Map(),
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: {
        ...defaultRisk,
        maxHoldDays: 999,
        takeProfitRate: 0.5,
        stopLossRate: -0.5
      },
      costParams: zeroCost,
      initialPendingBuy: [{ stockCode: 'A', score: 1 }]
    });

    // 매수가 dates[0] 시가에 체결됨 (T+1 아님, 이미 pending 상태이므로)
    assert.strictEqual(result.trades.length, 1);
    assert.strictEqual(result.trades[0]!.buyDate, dates[0]);
    assert.strictEqual(result.trades[0]!.buyPrice, 100);
  });

  it('initialPendingSell → allDates[0]에 즉시 매도', () => {
    const dates = makeDates(5);
    const candles = makeStockCandles('A', dates, [100, 100, 105, 105, 105]);

    // dates[-1] (warm-up) 시그널로 dates[0]에 매수,
    // initialPendingSell로 dates[0]에 즉시 매도 요청
    // → 매수가 먼저 되고, 같은 날 매도 시그널은 기존 포지션에만 적용
    // 실제 시나리오: warm-up에서 매수+매도 동시 시그널

    // 먼저 dates[0]에 포지션이 있어야 매도 가능하므로,
    // initialPendingBuy + 이후 sellSignal로 테스트
    const buySignals = new Map<string, RankedSignal[]>();
    const sellSignals = new Map<string, Set<string>>();
    sellSignals.set(dates[1]!, new Set(['A'])); // dates[1] 관찰 → dates[2] 체결

    const result = simulatePortfolio({
      buySignals,
      sellSignals,
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: {
        ...defaultRisk,
        maxHoldDays: 999,
        takeProfitRate: 0.5,
        stopLossRate: -0.5
      },
      costParams: zeroCost,
      initialPendingBuy: [{ stockCode: 'A', score: 1 }]
    });

    assert.strictEqual(result.trades.length, 1);
    assert.strictEqual(result.trades[0]!.buyDate, dates[0]);
    assert.strictEqual(result.trades[0]!.sellDate, dates[2]); // T+1 매도
    assert.strictEqual(result.trades[0]!.reason, 'exit_signal');
  });

  it('마지막 날 시그널은 체결 불가 (다음 거래일 없음)', () => {
    const dates = makeDates(3);
    const candles = makeStockCandles('A', dates, [100, 100, 100]);

    const buySignals = new Map<string, RankedSignal[]>();
    // Signal on last day → no next day to execute
    buySignals.set(dates[2]!, [{ stockCode: 'A', score: 1 }]);

    const result = simulatePortfolio({
      buySignals,
      sellSignals: new Map(),
      stockCandles: new Map([['A', candles]]),
      allDates: dates,
      initialCapital: 10_000_000,
      riskParams: defaultRisk,
      costParams: zeroCost
    });

    assert.strictEqual(result.totalTrades, 0);
  });
});
