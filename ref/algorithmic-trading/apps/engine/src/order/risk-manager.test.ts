import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { RiskManager } from './risk-manager.js';
import { EventBus, EngineEventType } from '../event/event-bus.js';
import type { EngineEvent } from '../event/event-bus.js';
import type { Signal, RiskParams } from '@trading/shared/types';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      side TEXT NOT NULL,
      order_type TEXT NOT NULL DEFAULT 'LIMIT',
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'CREATED',
      filled_quantity INTEGER DEFAULT 0,
      filled_price REAL DEFAULT 0,
      reject_reason TEXT,
      strategy TEXT NOT NULL DEFAULT '',
      signal TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
  return db;
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    stockCode: '005930',
    stockName: '삼성전자',
    side: 'buy',
    reason: 'volatility_breakout',
    confidence: 1.0,
    price: 72000,
    quantity: 10,
    paramsSnapshot: {} as Signal['paramsSnapshot'],
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

const defaultRiskParams: RiskParams = {
  maxPositions: 5,
  maxPositionWeight: 0.3,
  dailyLossLimit: -0.03,
  totalCapital: 10_000_000
};

function defaultPortfolio() {
  return {
    cash: 10_000_000,
    totalEquity: 10_000_000,
    positionCount: 0,
    stockValues: new Map<string, number>()
  };
}

describe('RiskManager', () => {
  let db: Database.Database;
  let bus: EventBus;
  let rm: RiskManager;

  beforeEach(() => {
    db = createTestDb();
    bus = new EventBus();
    rm = new RiskManager({ db, eventBus: bus });
  });

  afterEach(() => {
    db.close();
  });

  it('모든 조건 통과 시 APPROVED를 반환한다', () => {
    const decision = rm.checkBuyOrder(
      makeSignal(),
      defaultRiskParams,
      defaultPortfolio()
    );
    assert.equal(decision.approved, true);
    assert.equal(decision.action, 'APPROVED');
  });

  it('포지션 한도 초과 시 REJECTED를 반환한다', () => {
    const portfolio = { ...defaultPortfolio(), positionCount: 5 };
    const decision = rm.checkBuyOrder(
      makeSignal(),
      defaultRiskParams,
      portfolio
    );
    assert.equal(decision.approved, false);
    assert.equal(decision.eventType, 'POSITION_LIMIT');
  });

  it('종목 비중 초과 시 REJECTED를 반환한다', () => {
    const stockValues = new Map([['005930', 2_500_000]]);
    const portfolio = { ...defaultPortfolio(), stockValues };
    // 기존 2.5M + 주문 72000×10=720K = 3.22M → 32.2% > 30%
    const decision = rm.checkBuyOrder(
      makeSignal(),
      defaultRiskParams,
      portfolio
    );
    assert.equal(decision.approved, false);
    assert.equal(decision.eventType, 'WEIGHT_LIMIT');
  });

  it('현금 부족 시 REJECTED를 반환한다', () => {
    const portfolio = { ...defaultPortfolio(), cash: 500_000 };
    // 72000×10 = 720K > 500K cash, weight = 720K/10M = 7.2% < 30% → CAPITAL_LIMIT
    const decision = rm.checkBuyOrder(
      makeSignal({ quantity: 10 }),
      defaultRiskParams,
      portfolio
    );
    assert.equal(decision.approved, false);
    assert.equal(decision.eventType, 'CAPITAL_LIMIT');
  });

  it('중복 주문 시 REJECTED를 반환한다', () => {
    db.prepare(
      `
      INSERT INTO orders (order_id, stock_code, stock_name, side, quantity, price, status, strategy, signal)
      VALUES ('ORD-001', '005930', '삼성전자', 'buy', 10, 72000, 'PENDING', '', '')
    `
    ).run();

    const decision = rm.checkBuyOrder(
      makeSignal(),
      defaultRiskParams,
      defaultPortfolio()
    );
    assert.equal(decision.approved, false);
    assert.equal(decision.eventType, 'ORDER_REJECTED');
  });

  it('[MF-7] 일일 손실 한도 도달 시 PAUSE_ENGINE + RISK_LIMIT_HIT 이벤트', () => {
    const events: EngineEvent[] = [];
    bus.subscribe(EngineEventType.RISK_LIMIT_HIT, (e) => events.push(e));

    // totalEquity 9.5M / totalCapital 10M → -5% < -3%
    const portfolio = { ...defaultPortfolio(), totalEquity: 9_500_000 };
    const decision = rm.checkBuyOrder(
      makeSignal(),
      defaultRiskParams,
      portfolio
    );

    assert.equal(decision.approved, false);
    assert.equal(decision.action, 'PAUSE_ENGINE');
    assert.equal(decision.eventType, 'DAILY_LOSS_LIMIT');
    assert.equal(events.length, 1);
  });

  it('dailyLossBlocked 시 후속 주문도 차단한다', () => {
    // 손실 한도 트리거
    const lossPortfolio = { ...defaultPortfolio(), totalEquity: 9_500_000 };
    rm.checkBuyOrder(makeSignal(), defaultRiskParams, lossPortfolio);

    // 이후 정상 포트폴리오로도 차단
    const decision = rm.checkBuyOrder(
      makeSignal({ stockCode: '000660' }),
      defaultRiskParams,
      defaultPortfolio()
    );
    assert.equal(decision.approved, false);
    assert.equal(decision.action, 'BLOCK_ORDER');
  });

  it('resetDailyState 후 다시 주문 가능', () => {
    const lossPortfolio = { ...defaultPortfolio(), totalEquity: 9_500_000 };
    rm.checkBuyOrder(makeSignal(), defaultRiskParams, lossPortfolio);

    rm.resetDailyState();

    const decision = rm.checkBuyOrder(
      makeSignal(),
      defaultRiskParams,
      defaultPortfolio()
    );
    assert.equal(decision.approved, true);
  });

  it('[SF-3] 블랙리스트 종목은 차단된다', () => {
    rm.addToBlacklist('005930');
    const decision = rm.checkBuyOrder(
      makeSignal(),
      defaultRiskParams,
      defaultPortfolio()
    );
    assert.equal(decision.approved, false);
    assert.ok(decision.reason.includes('blacklisted'));
  });

  it('매도 주문은 중복 외 항상 승인한다', () => {
    const decision = rm.checkSellOrder(makeSignal({ side: 'sell' }));
    assert.equal(decision.approved, true);
  });

  it('매도 중복 주문은 거부한다', () => {
    db.prepare(
      `
      INSERT INTO orders (order_id, stock_code, stock_name, side, quantity, price, status, strategy, signal)
      VALUES ('ORD-001', '005930', '삼성전자', 'sell', 10, 72000, 'PENDING', '', '')
    `
    ).run();

    const decision = rm.checkSellOrder(makeSignal({ side: 'sell' }));
    assert.equal(decision.approved, false);
  });
});
