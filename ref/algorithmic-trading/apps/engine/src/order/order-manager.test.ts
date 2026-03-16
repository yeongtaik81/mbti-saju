import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { OrderManager } from './order-manager.js';
import { RiskManager } from './risk-manager.js';
import { EventBus, EngineEventType } from '../event/event-bus.js';
import type { EngineEvent } from '../event/event-bus.js';
import { createSchema } from '../db/schema.js';
import type { Signal } from '@trading/shared/types';
import type { KisRestClient } from '../kis/rest-client.js';

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    stockCode: '005930',
    stockName: '삼성전자',
    side: 'buy',
    reason: 'volatility_breakout+ma_cross',
    confidence: 1.0,
    price: 72000,
    quantity: 10,
    paramsSnapshot: {} as Signal['paramsSnapshot'],
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

const defaultPortfolio = {
  cash: 10_000_000,
  totalEquity: 10_000_000,
  positionCount: 0,
  stockValues: new Map<string, number>()
};

const defaultRisk = {
  maxPositions: 5,
  maxPositionWeight: 0.3,
  dailyLossLimit: -0.03,
  totalCapital: 10_000_000
};

function makeMockRestClient(): KisRestClient {
  return {
    placeOrder: mock.fn(async () => ({
      kisOrderNo: 'KIS-001',
      orderTime: '100530'
    })),
    cancelOrder: mock.fn(async () => ({ kisOrderNo: 'KIS-C01' })),
    modifyOrder: mock.fn(async () => ({ kisOrderNo: 'KIS-M01' })),
    getExecutions: mock.fn(async () => []),
    getOpenOrders: mock.fn(async () => [])
  } as unknown as KisRestClient;
}

describe('OrderManager', () => {
  let db: Database.Database;
  let bus: EventBus;
  let rm: RiskManager;
  let om: OrderManager;
  let restClient: KisRestClient;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    bus = new EventBus();
    rm = new RiskManager({ db, eventBus: bus });
    restClient = makeMockRestClient();
    om = new OrderManager({ db, restClient, riskManager: rm, eventBus: bus });
  });

  afterEach(() => {
    om.destroy();
    db.close();
  });

  it('신호 → 주문을 생성하고 실행한다', async () => {
    const events: EngineEvent[] = [];
    bus.subscribe(EngineEventType.ORDER_CREATED, (e) => events.push(e));
    bus.subscribe(EngineEventType.ORDER_SUBMITTED, (e) => events.push(e));

    const orderId = await om.executeSignal(
      makeSignal(),
      defaultPortfolio,
      defaultRisk
    );

    assert.ok(orderId);
    assert.ok(orderId.startsWith('ORD-'));

    // DB에 기록 확인
    const row = db
      .prepare('SELECT * FROM orders WHERE order_id = ?')
      .get(orderId) as Record<string, unknown>;
    assert.equal(row.stock_code, '005930');
    assert.equal(row.status, 'PENDING');
    assert.equal(row.kis_order_no, 'KIS-001');

    // 이벤트 발행 확인
    assert.equal(events.length, 2);
    assert.equal(events[0]!.type, 'order:created');
    assert.equal(events[1]!.type, 'order:submitted');
  });

  it('리스크 거부 시 null을 반환한다', async () => {
    const portfolio = { ...defaultPortfolio, positionCount: 5 }; // 한도 초과
    const orderId = await om.executeSignal(
      makeSignal(),
      portfolio,
      defaultRisk
    );
    assert.equal(orderId, null);
  });

  it('중복 주문 (동일 종목 동일 방향)을 방지한다 [MF-8]', async () => {
    const first = await om.executeSignal(
      makeSignal(),
      defaultPortfolio,
      defaultRisk
    );
    assert.ok(first);

    const second = await om.executeSignal(
      makeSignal(),
      defaultPortfolio,
      defaultRisk
    );
    assert.equal(second, null);
  });

  it('체결 처리 (전량)', async () => {
    const fillEvents: EngineEvent[] = [];
    bus.subscribe(EngineEventType.ORDER_FILLED, (e) => fillEvents.push(e));

    const orderId = await om.executeSignal(
      makeSignal(),
      defaultPortfolio,
      defaultRisk
    );
    assert.ok(orderId);

    om.handleExecution({
      kisOrderNo: 'KIS-001',
      stockCode: '005930',
      side: 'buy',
      filledQuantity: 10,
      filledPrice: 72000,
      filledAmount: 720000,
      executedAt: new Date().toISOString()
    });

    assert.equal(fillEvents.length, 1);

    // DB 확인
    const row = db
      .prepare('SELECT * FROM orders WHERE order_id = ?')
      .get(orderId) as Record<string, unknown>;
    assert.equal(row.status, 'FILLED');
    assert.equal(row.filled_quantity, 10);

    // 체결 기록
    const exec = db
      .prepare('SELECT * FROM executions WHERE order_id = ?')
      .get(orderId) as Record<string, unknown>;
    assert.ok(exec);
    assert.equal(exec.quantity, 10);
  });

  it('[MF-3] 동일 체결 중복 처리를 방지한다', async () => {
    const fillEvents: EngineEvent[] = [];
    bus.subscribe(EngineEventType.ORDER_FILLED, (e) => fillEvents.push(e));

    await om.executeSignal(makeSignal(), defaultPortfolio, defaultRisk);

    const execParams = {
      kisOrderNo: 'KIS-001',
      stockCode: '005930',
      side: 'buy' as const,
      filledQuantity: 10,
      filledPrice: 72000,
      filledAmount: 720000,
      executedAt: new Date().toISOString()
    };

    om.handleExecution(execParams);
    om.handleExecution(execParams); // 동일 체결 재전송

    assert.equal(fillEvents.length, 1); // 한 번만 처리
  });

  it('부분 체결 이벤트를 발행한다 [MF-4]', async () => {
    const partialEvents: EngineEvent[] = [];
    bus.subscribe(EngineEventType.ORDER_PARTIAL_FILLED, (e) =>
      partialEvents.push(e)
    );

    await om.executeSignal(
      makeSignal({ quantity: 10 }),
      defaultPortfolio,
      defaultRisk
    );

    om.handleExecution({
      kisOrderNo: 'KIS-001',
      stockCode: '005930',
      side: 'buy',
      filledQuantity: 5, // 10주 중 5주만
      filledPrice: 72000,
      filledAmount: 360000,
      executedAt: new Date().toISOString()
    });

    assert.equal(partialEvents.length, 1);
    assert.equal(
      (partialEvents[0]!.data as Record<string, unknown>).remainingQuantity,
      5
    );
  });

  it('전체 미체결 취소를 실행한다', async () => {
    const cancelEvents: EngineEvent[] = [];
    bus.subscribe(EngineEventType.ORDER_CANCELLED, (e) => cancelEvents.push(e));

    await om.executeSignal(makeSignal(), defaultPortfolio, defaultRisk);
    await om.cancelAllPending();

    assert.equal(cancelEvents.length, 1);
  });

  it('KIS 주문 실패 시 REJECTED + 블랙리스트', async () => {
    const rejEvents: EngineEvent[] = [];
    bus.subscribe(EngineEventType.ORDER_REJECTED, (e) => rejEvents.push(e));

    const failClient = {
      ...makeMockRestClient(),
      placeOrder: mock.fn(async () => {
        throw new Error('호가 오류');
      })
    } as unknown as KisRestClient;

    const om2 = new OrderManager({
      db,
      restClient: failClient,
      riskManager: rm,
      eventBus: bus
    });
    const orderId = await om2.executeSignal(
      makeSignal(),
      defaultPortfolio,
      defaultRisk
    );

    assert.equal(orderId, null);
    assert.equal(rejEvents.length, 1);

    // 블랙리스트 확인: 같은 종목 재주문 시 거부
    const decision = rm.checkBuyOrder(
      makeSignal(),
      defaultRisk,
      defaultPortfolio
    );
    assert.equal(decision.approved, false);

    om2.destroy();
  });
});
