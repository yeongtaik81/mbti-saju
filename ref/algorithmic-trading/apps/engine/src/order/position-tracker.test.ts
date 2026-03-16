import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { PositionTracker } from './position-tracker.js';
import { EventBus, EngineEventType } from '../event/event-bus.js';
import { createSchema } from '../db/schema.js';

describe('PositionTracker', () => {
  let db: Database.Database;
  let bus: EventBus;
  let pt: PositionTracker;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    bus = new EventBus();
    pt = new PositionTracker({ db, eventBus: bus });
    pt.start();
  });

  afterEach(() => {
    pt.stop();
    db.close();
  });

  it('매수 체결 시 포지션을 오픈한다', () => {
    const posEvents: unknown[] = [];
    bus.subscribe(EngineEventType.POSITION_OPENED, (e) => posEvents.push(e));

    bus.publish({
      type: EngineEventType.ORDER_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ORD-001',
        stockCode: '005930',
        side: 'buy',
        filledQuantity: 10,
        filledPrice: 72000
      }
    });

    const positions = pt.getOpenPositions();
    assert.equal(positions.length, 1);
    assert.equal(positions[0]!.stockCode, '005930');
    assert.equal(positions[0]!.quantity, 10);
    assert.equal(positions[0]!.avgPrice, 72000);
    assert.equal(posEvents.length, 1);
  });

  it('매도 체결 시 포지션을 청산하고 거래를 기록한다', () => {
    const closeEvents: unknown[] = [];
    bus.subscribe(EngineEventType.POSITION_CLOSED, (e) => closeEvents.push(e));

    // 먼저 매수/매도 주문 레코드 생성
    db.prepare(
      `
      INSERT INTO orders (order_id, stock_code, stock_name, side, order_type, quantity, price, status, strategy, signal)
      VALUES ('ORD-001', '005930', '삼성전자', 'buy', 'LIMIT', 10, 72000, 'FILLED', 'test', 'test')
    `
    ).run();
    db.prepare(
      `
      INSERT INTO orders (order_id, stock_code, stock_name, side, order_type, quantity, price, status, strategy, signal)
      VALUES ('ORD-002', '005930', '삼성전자', 'sell', 'LIMIT', 10, 75000, 'FILLED', 'test', 'test')
    `
    ).run();

    bus.publish({
      type: EngineEventType.ORDER_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ORD-001',
        stockCode: '005930',
        side: 'buy',
        filledQuantity: 10,
        filledPrice: 72000
      }
    });

    // 매도 체결
    bus.publish({
      type: EngineEventType.ORDER_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ORD-002',
        stockCode: '005930',
        side: 'sell',
        filledQuantity: 10,
        filledPrice: 75000
      }
    });

    // 포지션 청산 확인
    assert.equal(pt.getOpenPositions().length, 0);
    assert.equal(closeEvents.length, 1);

    // 거래 기록 확인
    const trade = db.prepare('SELECT * FROM trades').get() as Record<
      string,
      unknown
    >;
    assert.ok(trade);
    assert.equal(trade.stock_code, '005930');
    assert.equal(trade.buy_price, 72000);
    assert.equal(trade.sell_price, 75000);
    assert.ok((trade.pnl as number) > 0); // 이익
  });

  it('부분 체결 시 포지션을 업데이트한다 [MF-4]', () => {
    bus.publish({
      type: EngineEventType.ORDER_PARTIAL_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        stockCode: '005930',
        side: 'buy',
        filledQuantity: 5,
        filledPrice: 72000
      }
    });

    const positions = pt.getOpenPositions();
    assert.equal(positions.length, 1);
    assert.equal(positions[0]!.quantity, 5);
  });

  it('[M1] 부분체결→전량체결 시 수량 이중 계산을 방지한다', () => {
    // 부분 체결: 5주
    bus.publish({
      type: EngineEventType.ORDER_PARTIAL_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        stockCode: '005930',
        side: 'buy',
        filledQuantity: 5,
        filledPrice: 72000
      }
    });

    assert.equal(pt.getOpenPositions()[0]!.quantity, 5);

    // 전량 체결: 누적 10주 (5+5가 아닌 10으로 대체)
    bus.publish({
      type: EngineEventType.ORDER_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ORD-001',
        stockCode: '005930',
        side: 'buy',
        filledQuantity: 10,
        filledPrice: 72000
      }
    });

    const positions = pt.getOpenPositions();
    assert.equal(positions.length, 1);
    assert.equal(positions[0]!.quantity, 10); // 15가 아닌 10
  });

  it('[M5] 매도 부분체결 시 포지션 수량이 감소한다', () => {
    // 먼저 매수
    bus.publish({
      type: EngineEventType.ORDER_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ORD-001',
        stockCode: '005930',
        side: 'buy',
        filledQuantity: 10,
        filledPrice: 72000
      }
    });

    // 매도 부분체결: 3주
    bus.publish({
      type: EngineEventType.ORDER_PARTIAL_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        stockCode: '005930',
        side: 'sell',
        filledQuantity: 3,
        filledPrice: 75000
      }
    });

    const positions = pt.getOpenPositions();
    assert.equal(positions.length, 1);
    assert.equal(positions[0]!.quantity, 7); // 10 - 3 = 7
  });

  it('실시간 가격 업데이트가 P&L에 반영된다', () => {
    bus.publish({
      type: EngineEventType.ORDER_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ORD-001',
        stockCode: '005930',
        side: 'buy',
        filledQuantity: 10,
        filledPrice: 72000
      }
    });

    pt.updatePrices(new Map([['005930', 75000]]));

    const positions = pt.getOpenPositions();
    assert.equal(positions[0]!.currentPrice, 75000);
    // pnl = (75000 - 72000) * 10 = 30000
    assert.equal(positions[0]!.pnl, 30000);
  });

  it('포트폴리오 스냅샷을 저장한다', () => {
    bus.publish({
      type: EngineEventType.ORDER_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ORD-001',
        stockCode: '005930',
        side: 'buy',
        filledQuantity: 10,
        filledPrice: 72000
      }
    });

    pt.updatePrices(new Map([['005930', 73000]]));
    pt.saveSnapshot('2026-03-05', 9_280_000, 10_000_000);

    const snap = db
      .prepare('SELECT * FROM portfolio_snapshots WHERE date = ?')
      .get('2026-03-05') as Record<string, unknown>;
    assert.ok(snap);
    assert.equal(snap.cash, 9_280_000);
    assert.ok((snap.stock_value as number) > 0);
  });

  it('verifyAllClosed는 포지션이 0일 때 true를 반환한다', () => {
    assert.equal(pt.verifyAllClosed(), true);

    bus.publish({
      type: EngineEventType.ORDER_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ORD-001',
        stockCode: '005930',
        side: 'buy',
        filledQuantity: 10,
        filledPrice: 72000
      }
    });

    assert.equal(pt.verifyAllClosed(), false);
  });

  it('start/stop 라이프사이클이 동작한다', () => {
    pt.stop();

    bus.publish({
      type: EngineEventType.ORDER_FILLED,
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ORD-001',
        stockCode: '005930',
        side: 'buy',
        filledQuantity: 10,
        filledPrice: 72000
      }
    });

    // stop 후에는 이벤트 미처리
    assert.equal(pt.getOpenPositions().length, 0);
  });
});
