import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { runLabBacktest } from './run-lab-backtest.js';
import { STRATEGY_TYPE } from './types.js';
import type { LabBacktestConfig } from './types.js';

/** 인메모리 DB에 daily_candles 테이블 생성 + 샘플 데이터 삽입 */
function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE daily_candles (
      stock_code TEXT NOT NULL,
      date TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      adj_close REAL,
      volume INTEGER NOT NULL DEFAULT 10000,
      amount REAL,
      PRIMARY KEY (stock_code, date)
    )
  `);

  const insert = db.prepare(
    'INSERT INTO daily_candles (stock_code, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // 200거래일 분량 생성 (2024-01-01 ~ 2024-10-18 weekday only)
  const stockCodes = ['005930', '000660'];
  let d = new Date('2024-01-02');
  const dates: string[] = [];
  while (dates.length < 200) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().slice(0, 10));
    }
    d = new Date(d.getTime() + 86400000);
  }

  const insertMany = db.transaction(() => {
    for (const code of stockCodes) {
      const basePrice = code === '005930' ? 70000 : 150000;
      for (let i = 0; i < dates.length; i++) {
        // 약간의 상승 추세 + 노이즈
        const noise = Math.sin(i * 0.1) * basePrice * 0.03;
        const price = basePrice + (i / dates.length) * basePrice * 0.2 + noise;
        const open = price;
        const high = price * 1.02;
        const low = price * 0.98;
        const close = price + Math.sin(i * 0.3) * basePrice * 0.01;
        insert.run(code, dates[i], open, high, low, close, 10000 + i * 100);
      }
    }
  });
  insertMany();

  return db;
}

describe('runLabBacktest (orchestration)', () => {
  let db: Database.Database;

  before(() => {
    db = createTestDb();
  });

  after(() => {
    db.close();
  });

  const baseConfig: LabBacktestConfig = {
    algorithmId: 'test-algo-1',
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    name: 'MA Crossover Test',
    params: { shortPeriod: 5, longPeriod: 20 },
    riskParams: {
      stopLossRate: -0.05,
      takeProfitRate: 0.1,
      maxHoldDays: 30,
      maxPositions: 5,
      maxWeight: 0.3
    },
    stockCodes: ['005930', '000660'],
    startDate: '2024-03-01',
    endDate: '2024-09-30',
    initialCapital: 100_000_000
  };

  it('MA Crossover end-to-end 실행', () => {
    const result = runLabBacktest(db, baseConfig);

    // 결과 구조 검증
    assert.ok(result.runId, 'should have runId');
    assert.strictEqual(result.algorithmId, 'test-algo-1');
    assert.strictEqual(result.strategyType, STRATEGY_TYPE.MA_CROSSOVER);
    assert.strictEqual(result.executionModel, 'daily');
    assert.ok(result.equityCurve.length > 0, 'should have equity curve');
    assert.ok(result.createdAt, 'should have createdAt');

    // 메트릭 범위 검증
    assert.ok(
      result.mdd >= 0 && result.mdd <= 1,
      `MDD should be 0~1, got ${result.mdd}`
    );
    assert.ok(
      result.winRate >= 0 && result.winRate <= 1,
      `winRate should be 0~1, got ${result.winRate}`
    );
    assert.ok(
      result.profitFactor >= 0,
      `profitFactor should be >= 0, got ${result.profitFactor}`
    );
  });

  it('동일 config → 동일 runId (재현성)', () => {
    const r1 = runLabBacktest(db, baseConfig);
    const r2 = runLabBacktest(db, baseConfig);
    assert.strictEqual(
      r1.runId,
      r2.runId,
      'Same config should produce same runId'
    );
  });

  it('다른 costParams → 다른 runId', () => {
    const r1 = runLabBacktest(db, baseConfig);
    const r2 = runLabBacktest(db, {
      ...baseConfig,
      costParams: { slippageRate: 0.005, feeRate: 0.001, taxRate: 0.01 }
    });
    assert.notStrictEqual(r1.runId, r2.runId);
  });

  it('costParams 기본값 병합', () => {
    const result = runLabBacktest(db, baseConfig);
    assert.ok(
      result.costParams.slippageRate > 0,
      'default slippage should be applied'
    );
    assert.ok(result.costParams.feeRate > 0, 'default fee should be applied');
    assert.ok(result.costParams.taxRate > 0, 'default tax should be applied');
  });

  it('미등록 전략 → 에러', () => {
    assert.throws(() => {
      runLabBacktest(db, {
        ...baseConfig,
        strategyType: 'nonexistent' as any
      });
    }, /Unknown strategy type/);
  });

  it('존재하지 않는 종목 → 에러', () => {
    assert.throws(() => {
      runLabBacktest(db, {
        ...baseConfig,
        stockCodes: ['999999']
      });
    }, /No trading days/);
  });

  it('모든 전략 타입 실행 가능', () => {
    const strategyConfigs: Record<string, Record<string, number>> = {
      [STRATEGY_TYPE.DUAL_MOMENTUM]: { lookback: 60, holdDays: 20, topN: 3 },
      [STRATEGY_TYPE.MA_CROSSOVER]: { shortPeriod: 5, longPeriod: 20 },
      [STRATEGY_TYPE.BB_RSI]: {
        bbPeriod: 20,
        bbK: 2,
        rsiPeriod: 14,
        rsiLow: 30,
        rsiHigh: 70
      },
      [STRATEGY_TYPE.TURTLE]: {
        entryPeriod: 20,
        exitPeriod: 10,
        atrPeriod: 14,
        atrMultiple: 2
      },
      [STRATEGY_TYPE.VOLATILITY_BREAKOUT]: {
        k: 0.5,
        shortMaPeriod: 5,
        longMaPeriod: 20,
        rsiPeriod: 14,
        rsiLow: 30,
        rsiHigh: 70
      }
    };

    for (const [type, params] of Object.entries(strategyConfigs)) {
      const result = runLabBacktest(db, {
        ...baseConfig,
        strategyType: type as any,
        params
      });
      assert.ok(
        result.equityCurve.length > 0,
        `${type} should produce equity curve`
      );
      assert.ok(
        typeof result.totalReturn === 'number',
        `${type} should have totalReturn`
      );
    }
  });

  it('equity curve 날짜 정렬 + 연속성', () => {
    const result = runLabBacktest(db, baseConfig);
    for (let i = 1; i < result.equityCurve.length; i++) {
      assert.ok(
        result.equityCurve[i]!.date > result.equityCurve[i - 1]!.date,
        'Equity curve dates should be strictly increasing'
      );
    }
  });

  it('trades의 buyDate < sellDate', () => {
    const result = runLabBacktest(db, baseConfig);
    for (const trade of result.trades) {
      assert.ok(
        trade.buyDate <= trade.sellDate,
        `buyDate ${trade.buyDate} should be <= sellDate ${trade.sellDate}`
      );
    }
  });

  it('equity curve가 요청 구간(startDate~endDate) 내에만 존재', () => {
    const result = runLabBacktest(db, baseConfig);
    const firstDate = result.equityCurve[0]!.date;
    const lastDate = result.equityCurve[result.equityCurve.length - 1]!.date;

    assert.ok(
      firstDate >= baseConfig.startDate,
      `First equity date ${firstDate} should be >= startDate ${baseConfig.startDate}`
    );
    assert.ok(
      lastDate <= baseConfig.endDate,
      `Last equity date ${lastDate} should be <= endDate ${baseConfig.endDate}`
    );
  });

  it('runLabBacktest() 결과에서 warm-up 경계 체결 직접 검증', () => {
    // 전용 DB: golden cross가 warm-up 마지막 날에 정확히 발생하도록 가격 설계
    // shortPeriod=3, longPeriod=5 → minLookback=10
    // 가격: days 0-9 flat 100, days 10-12 drop 80, day 13 spike 130, days 14+ stay 130
    // → day 13에서 shortMA(96.67) > longMA(94), 직전 shortMA(80) < longMA(88) = golden cross
    // startDate = dates[14], warm-up last day = dates[13]
    const boundaryDb = new Database(':memory:');
    boundaryDb.exec(`
      CREATE TABLE daily_candles (
        stock_code TEXT NOT NULL, date TEXT NOT NULL,
        open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL,
        close REAL NOT NULL, adj_close REAL, volume INTEGER NOT NULL DEFAULT 10000,
        amount REAL, PRIMARY KEY (stock_code, date)
      )
    `);

    const ins = boundaryDb.prepare(
      'INSERT INTO daily_candles (stock_code, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    let dt = new Date('2024-01-02');
    const bDates: string[] = [];
    while (bDates.length < 30) {
      const day = dt.getDay();
      if (day !== 0 && day !== 6) bDates.push(dt.toISOString().slice(0, 10));
      dt = new Date(dt.getTime() + 86400000);
    }
    const bPrices = bDates.map((_, i) => (i <= 9 ? 100 : i <= 12 ? 80 : 130));
    const insTx = boundaryDb.transaction(() => {
      for (let i = 0; i < bDates.length; i++) {
        const p = bPrices[i]!;
        ins.run('TEST01', bDates[i], p, p * 1.02, p * 0.98, p, 10000);
      }
    });
    insTx();

    try {
      const bConfig: LabBacktestConfig = {
        algorithmId: 'boundary-test',
        strategyType: STRATEGY_TYPE.MA_CROSSOVER,
        name: 'Boundary Test',
        params: { shortPeriod: 3, longPeriod: 5 },
        riskParams: {
          stopLossRate: -0.5,
          takeProfitRate: 0.5,
          maxHoldDays: 999,
          maxPositions: 5,
          maxWeight: 0.5
        },
        stockCodes: ['TEST01'],
        startDate: bDates[14]!,
        endDate: bDates[29]!,
        initialCapital: 100_000_000
      };

      const result = runLabBacktest(boundaryDb, bConfig);

      // 1. equityCurve 첫 날 = startDate (warm-up 오염 없음)
      assert.strictEqual(
        result.equityCurve[0]!.date,
        bDates[14],
        `First equity date should be startDate ${bDates[14]}`
      );

      // 2. startDate 첫 날에 매수 체결이 있어야 함
      //    (warm-up 마지막 날 dates[13]의 golden cross → startDate dates[14]에 T+1 체결)
      const startDateBuys = result.trades.filter(
        (t) => t.buyDate === bDates[14]
      );
      assert.ok(
        startDateBuys.length > 0,
        `Expected trade on startDate ${bDates[14]} from warm-up golden cross on ${bDates[13]}, ` +
          `but found trades only on: ${result.trades.map((t) => t.buyDate).join(', ') || 'none'}`
      );
      assert.strictEqual(startDateBuys[0]!.stockCode, 'TEST01');

      // 3. 모든 trades의 buyDate >= startDate
      for (const trade of result.trades) {
        assert.ok(
          trade.buyDate >= bConfig.startDate,
          `buyDate ${trade.buyDate} should be >= startDate ${bConfig.startDate}`
        );
      }

      // 4. equityCurve에 warm-up 날짜 없음
      for (const pt of result.equityCurve) {
        assert.ok(
          pt.date >= bConfig.startDate,
          `${pt.date} should not be before startDate`
        );
      }
    } finally {
      boundaryDb.close();
    }
  });
});
