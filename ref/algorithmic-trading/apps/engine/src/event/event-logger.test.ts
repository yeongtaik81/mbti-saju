import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { EventBus, EngineEventType } from './event-bus.js';
import type { EngineEvent } from './event-bus.js';
import { EventLogger } from './event-logger.js';

function makeEvent(
  type: EngineEvent['type'],
  data: Record<string, unknown> = {}
): EngineEvent {
  return { type, timestamp: new Date().toISOString(), data };
}

describe('EventLogger', () => {
  let db: Database.Database;
  let bus: EventBus;
  let logger: EventLogger;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE order_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE risk_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '{}',
        action_taken TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
    bus = new EventBus();
    logger = new EventLogger(db, bus);
  });

  afterEach(() => {
    logger.stop();
    db.close();
  });

  it('ORDER 이벤트를 order_events 테이블에 기록한다', () => {
    logger.start();

    bus.publish(
      makeEvent(EngineEventType.ORDER_CREATED, {
        orderId: 'ORD-001',
        stockCode: '005930'
      })
    );
    bus.publish(
      makeEvent(EngineEventType.ORDER_SUBMITTED, { orderId: 'ORD-001' })
    );
    bus.publish(
      makeEvent(EngineEventType.ORDER_FILLED, {
        orderId: 'ORD-001',
        filledQty: 10
      })
    );

    const rows = db.prepare('SELECT * FROM order_events').all() as Array<
      Record<string, unknown>
    >;
    assert.equal(rows.length, 3);
    assert.equal(rows[0]!.order_id, 'ORD-001');
    assert.equal(rows[0]!.event_type, 'order:created');
  });

  it('RISK 이벤트를 risk_events 테이블에 기록한다', () => {
    logger.start();

    bus.publish(
      makeEvent(EngineEventType.RISK_APPROVED, {
        action: 'APPROVED',
        stockCode: '005930'
      })
    );
    bus.publish(
      makeEvent(EngineEventType.RISK_REJECTED, {
        action: 'REJECTED',
        reason: 'POSITION_LIMIT'
      })
    );
    bus.publish(
      makeEvent(EngineEventType.RISK_LIMIT_HIT, {
        action: 'PAUSE_ENGINE',
        type: 'DAILY_LOSS_LIMIT'
      })
    );

    const rows = db.prepare('SELECT * FROM risk_events').all() as Array<
      Record<string, unknown>
    >;
    assert.equal(rows.length, 3);
    assert.equal(rows[0]!.action_taken, 'APPROVED');
    assert.equal(rows[1]!.action_taken, 'REJECTED');
    assert.equal(rows[2]!.action_taken, 'PAUSE_ENGINE');
  });

  it('SESSION/SIGNAL/POSITION/ENGINE 이벤트를 audit_log에 기록한다', () => {
    logger.start();

    bus.publish(
      makeEvent(EngineEventType.SESSION_TRANSITION, {
        from: 'IDLE',
        to: 'PRE_MARKET'
      })
    );
    bus.publish(makeEvent(EngineEventType.SIGNAL_BUY, { stockCode: '005930' }));
    bus.publish(
      makeEvent(EngineEventType.POSITION_OPENED, { stockCode: '005930' })
    );
    bus.publish(
      makeEvent(EngineEventType.ENGINE_ERROR, { message: 'test error' })
    );
    bus.publish(makeEvent(EngineEventType.ALERT, { title: 'test alert' }));

    const rows = db.prepare('SELECT * FROM audit_log').all() as Array<
      Record<string, unknown>
    >;
    assert.equal(rows.length, 5);
    assert.equal(rows[0]!.actor, 'system');
    assert.equal(rows[0]!.action, 'session:transition');
  });

  it('start/stop 라이프사이클이 동작한다', () => {
    logger.start();

    bus.publish(
      makeEvent(EngineEventType.ORDER_CREATED, { orderId: 'ORD-001' })
    );
    let rows = db.prepare('SELECT * FROM order_events').all() as Array<
      Record<string, unknown>
    >;
    assert.equal(rows.length, 1);

    logger.stop();

    bus.publish(
      makeEvent(EngineEventType.ORDER_CREATED, { orderId: 'ORD-002' })
    );
    rows = db.prepare('SELECT * FROM order_events').all() as Array<
      Record<string, unknown>
    >;
    assert.equal(rows.length, 1); // stop 후에는 기록되지 않음
  });

  it('중복 start 호출 시 이벤트가 중복 기록되지 않는다', () => {
    logger.start();
    logger.start(); // 중복

    bus.publish(
      makeEvent(EngineEventType.ORDER_CREATED, { orderId: 'ORD-001' })
    );

    const rows = db.prepare('SELECT * FROM order_events').all() as Array<
      Record<string, unknown>
    >;
    assert.equal(rows.length, 1);
  });

  it('orderId가 없는 ORDER 이벤트도 처리한다', () => {
    logger.start();

    bus.publish(
      makeEvent(EngineEventType.ORDER_REJECTED, { reason: 'no orderId' })
    );

    const rows = db.prepare('SELECT * FROM order_events').all() as Array<
      Record<string, unknown>
    >;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.order_id, 'unknown');
  });
});
