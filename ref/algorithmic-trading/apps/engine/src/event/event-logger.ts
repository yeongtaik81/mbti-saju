import type Database from 'better-sqlite3';
import type { EventBus, EngineEvent } from './event-bus.js';

/**
 * EventLogger: 모든 엔진 이벤트를 DB에 기록
 * [MF-1] order_events, risk_events, audit_log의 유일한 writer
 * '*' 와일드카드로 전체 이벤트 수신 → 유형별 라우팅
 */
export class EventLogger {
  private readonly db: Database.Database;
  private readonly eventBus: EventBus;
  private readonly handler: (event: EngineEvent) => void;
  private started = false;

  private readonly insertOrderEvent: Database.Statement;
  private readonly insertRiskEvent: Database.Statement;
  private readonly insertAuditLog: Database.Statement;

  constructor(db: Database.Database, eventBus: EventBus) {
    this.db = db;
    this.eventBus = eventBus;

    this.insertOrderEvent = this.db.prepare(`
      INSERT INTO order_events (order_id, event_type, detail) VALUES (?, ?, ?)
    `);

    this.insertRiskEvent = this.db.prepare(`
      INSERT INTO risk_events (event_type, detail, action_taken) VALUES (?, ?, ?)
    `);

    this.insertAuditLog = this.db.prepare(`
      INSERT INTO audit_log (actor, action, detail) VALUES (?, ?, ?)
    `);

    this.handler = (event: EngineEvent) => this.routeEvent(event);
  }

  start(): void {
    if (this.started) return;
    this.eventBus.subscribe('*', this.handler);
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.eventBus.unsubscribe('*', this.handler);
    this.started = false;
  }

  private routeEvent(event: EngineEvent): void {
    try {
      const { type, data } = event;

      if (type.startsWith('order:')) {
        this.logOrderEvent(event);
      } else if (type.startsWith('risk:')) {
        this.logRiskEvent(event);
      } else if (
        type.startsWith('session:') ||
        type === 'engine:error' ||
        type === 'alert'
      ) {
        this.logAuditEvent(event);
      } else if (type.startsWith('signal:') || type.startsWith('position:')) {
        this.logAuditEvent(event);
      }
    } catch (err) {
      console.error('[EventLogger] Failed to log event:', event.type, err);
    }
  }

  private logOrderEvent(event: EngineEvent): void {
    const orderId = (event.data.orderId as string) ?? 'unknown';
    this.insertOrderEvent.run(orderId, event.type, JSON.stringify(event.data));
  }

  private logRiskEvent(event: EngineEvent): void {
    const actionTaken = (event.data.action as string) ?? 'UNKNOWN';
    this.insertRiskEvent.run(
      event.type,
      JSON.stringify(event.data),
      actionTaken
    );
  }

  private logAuditEvent(event: EngineEvent): void {
    this.insertAuditLog.run('system', event.type, JSON.stringify(event.data));
  }
}
