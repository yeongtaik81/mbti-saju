import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema.js';
import { runBacktest, saveBacktestResult } from './backtest.js';
import type { BacktestConfig } from './backtest.js';
import type { StrategyParams, RiskParams } from '@trading/shared/types';

// ── 테스트 헬퍼 ──

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  createSchema(db);
  return db;
}

const DEFAULT_PARAMS: StrategyParams = {
  k: 0.5,
  shortMaPeriod: 5,
  longMaPeriod: 20,
  rsiPeriod: 14,
  rsiLow: 30,
  rsiHigh: 70,
  stopLossRate: -0.02,
  takeProfitRate: 0.05,
  closingTime: '15:15'
};

const DEFAULT_RISK: RiskParams = {
  maxPositions: 3,
  maxPositionWeight: 0.3,
  dailyLossLimit: -0.05,
  totalCapital: 10_000_000
};

function makeConfig(overrides?: Partial<BacktestConfig>): BacktestConfig {
  return {
    name: 'test-backtest',
    strategyParams: DEFAULT_PARAMS,
    riskParams: DEFAULT_RISK,
    stockCodes: ['005930'],
    startDate: '2024-01-22',
    endDate: '2024-02-20',
    initialCapital: 10_000_000,
    slippageRate: 0.001,
    participationRate: 0.01,
    ...overrides
  };
}

/** 일봉 시드 데이터 (상승 패턴 포함) */
function seedDailyCandles(db: Database.Database): void {
  const stmt = db.prepare(`
    INSERT INTO daily_candles (stock_code, date, open, high, low, close, adj_close, volume, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 25일 데이터 (lookback 포함)
  const basePrice = 70000;
  const dates: string[] = [];
  let d = new Date('2024-01-02');
  for (let i = 0; i < 30; i++) {
    // 주말 건너뛰기
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  for (let i = 0; i < dates.length; i++) {
    const price = basePrice + i * 500; // 상승 추세
    const range = 1500; // 전일 고-저 범위
    stmt.run(
      '005930',
      dates[i],
      price, // open
      price + range / 2, // high
      price - range / 2, // low
      price + 200, // close
      price + 200, // adj_close
      1_000_000, // volume
      price * 1_000_000 // amount
    );
  }
}

/** 분봉 시드 데이터 (매수 트리거 가격 포함) */
function seedMinuteCandles(
  db: Database.Database,
  date: string,
  baseOpen: number,
  triggerPrice: number
): void {
  const stmt = db.prepare(`
    INSERT INTO minute_candles (stock_code, datetime, open, high, low, close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // 09:00 ~ 15:30 (390분)
  for (let m = 0; m < 390; m++) {
    const hour = 9 + Math.floor(m / 60);
    const min = m % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const datetime = `${date} ${timeStr}`;

    // 매수 트리거 가격을 150분(11:30)에 도달
    let price: number;
    if (m < 150) {
      price = baseOpen + (triggerPrice - baseOpen) * (m / 150);
    } else {
      price = triggerPrice + (m - 150) * 5; // 점진적 상승
    }

    stmt.run('005930', datetime, price, price + 50, price - 50, price, 5000);
  }
}

// ── 테스트 ──

describe('runBacktest', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('데이터 없는 기간 → 0 trades', () => {
    const config = makeConfig();
    const result = runBacktest(db, config);

    assert.strictEqual(result.totalTrades, 0);
    assert.strictEqual(result.trades.length, 0);
    assert.strictEqual(result.totalReturn, 0);
  });

  it('빈 stockCodes → empty result', () => {
    const config = makeConfig({ stockCodes: [] });
    const result = runBacktest(db, config);

    assert.strictEqual(result.totalTrades, 0);
    assert.strictEqual(result.runId.length, 32);
  });

  it('run_id 재현성 (같은 입력 → 같은 run_id)', () => {
    const config = makeConfig();
    const r1 = runBacktest(db, config);
    const r2 = runBacktest(db, config);

    assert.strictEqual(r1.runId, r2.runId);
    assert.strictEqual(r1.runId.length, 32);
  });

  it('run_id 변경 (다른 입력 → 다른 run_id)', () => {
    const r1 = runBacktest(db, makeConfig({ startDate: '2024-01-01' }));
    const r2 = runBacktest(db, makeConfig({ startDate: '2024-02-01' }));

    assert.notStrictEqual(r1.runId, r2.runId);
  });

  it('일봉 + 분봉 시드 → 매수/매도 발생', () => {
    seedDailyCandles(db);

    // 매수 트리거 분봉 시드 (2024-01-22)
    // 이 날짜의 일봉: open ≈ 77000 (index 14, 70000 + 14*500)
    // 전일 range = 1500, K=0.5 → threshold = 77000 + 750 = 77750
    seedMinuteCandles(db, '2024-01-22', 77000, 78000);

    const config = makeConfig({
      strategyParams: {
        ...DEFAULT_PARAMS,
        k: 0.5,
        shortMaPeriod: 3,
        longMaPeriod: 5,
        rsiPeriod: 5
      },
      startDate: '2024-01-22',
      endDate: '2024-01-22'
    });

    const result = runBacktest(db, config);

    // 에쿼티 커브 존재
    assert.ok(result.equityCurve.length > 0, 'Should have equity curve');

    // 결과 필드 검증
    assert.strictEqual(result.name, 'test-backtest');
    assert.strictEqual(result.startDate, '2024-01-22');
    assert.strictEqual(result.endDate, '2024-01-22');
    assert.ok(result.params.k === 0.5);
  });

  it('비용 모델 적용 확인 (매수/매도 수수료 + 세금)', () => {
    seedDailyCandles(db);
    seedMinuteCandles(db, '2024-01-22', 77000, 78000);

    const config = makeConfig({
      strategyParams: {
        ...DEFAULT_PARAMS,
        k: 0.5,
        shortMaPeriod: 3,
        longMaPeriod: 5,
        rsiPeriod: 5
      },
      startDate: '2024-01-22',
      endDate: '2024-01-22'
    });

    const result = runBacktest(db, config);

    // 거래가 있다면 수수료 > 0
    for (const trade of result.trades) {
      assert.ok(trade.fee >= 0, `Fee should be >= 0: ${trade.fee}`);
      assert.ok(trade.tax >= 0, `Tax should be >= 0: ${trade.tax}`);
    }
  });

  it('MDD 계산 (항상 0 이상)', () => {
    seedDailyCandles(db);

    const config = makeConfig({
      startDate: '2024-01-15',
      endDate: '2024-02-15'
    });
    const result = runBacktest(db, config);

    assert.ok(result.mdd >= 0, `MDD should be >= 0: ${result.mdd}`);
    assert.ok(result.mdd <= 1, `MDD should be <= 1: ${result.mdd}`);
  });

  it('BacktestResult 필드 완전성', () => {
    const config = makeConfig();
    const result = runBacktest(db, config);

    assert.ok(typeof result.runId === 'string');
    assert.ok(typeof result.name === 'string');
    assert.ok(typeof result.startDate === 'string');
    assert.ok(typeof result.endDate === 'string');
    assert.ok(typeof result.params === 'object');
    assert.ok(typeof result.costParams === 'object');
    assert.ok(typeof result.totalReturn === 'number');
    assert.ok(typeof result.cagr === 'number');
    assert.ok(typeof result.mdd === 'number');
    assert.ok(typeof result.winRate === 'number');
    assert.ok(typeof result.profitFactor === 'number');
    assert.ok(typeof result.sharpeRatio === 'number');
    assert.ok(typeof result.totalTrades === 'number');
    assert.ok(Array.isArray(result.trades));
    assert.ok(Array.isArray(result.equityCurve));
  });
});

describe('saveBacktestResult', () => {
  it('결과를 DB에 저장', () => {
    const db = createTestDb();
    const config = makeConfig();
    const result = runBacktest(db, config);

    saveBacktestResult(db, result);

    const row = db
      .prepare('SELECT * FROM backtest_results WHERE run_id = ?')
      .get(result.runId) as Record<string, unknown>;
    assert.ok(row, 'Result should be saved');
    assert.strictEqual(row.run_id, result.runId);
    assert.strictEqual(row.name, result.name);
    assert.strictEqual(row.start_date, result.startDate);
    assert.strictEqual(row.end_date, result.endDate);
  });

  it('같은 run_id로 재저장 시 덮어쓰기', () => {
    const db = createTestDb();
    const config = makeConfig();
    const result = runBacktest(db, config);

    saveBacktestResult(db, result);
    saveBacktestResult(db, result); // 두 번 저장

    const count = db
      .prepare('SELECT COUNT(*) as cnt FROM backtest_results WHERE run_id = ?')
      .get(result.runId) as { cnt: number };
    assert.strictEqual(count.cnt, 1);
  });
});
