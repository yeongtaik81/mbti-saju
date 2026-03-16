import { EventEmitter } from 'node:events';

/** 엔진 이벤트 유형 */
export const EngineEventType = {
  ORDER_CREATED: 'order:created',
  ORDER_SUBMITTED: 'order:submitted',
  ORDER_FILLED: 'order:filled',
  ORDER_PARTIAL_FILLED: 'order:partial_filled',
  ORDER_REJECTED: 'order:rejected',
  ORDER_CANCELLED: 'order:cancelled',
  SIGNAL_BUY: 'signal:buy',
  SIGNAL_SELL: 'signal:sell',
  RISK_APPROVED: 'risk:approved',
  RISK_REJECTED: 'risk:rejected',
  RISK_LIMIT_HIT: 'risk:limit_hit',
  POSITION_OPENED: 'position:opened',
  POSITION_CLOSED: 'position:closed',
  SESSION_TRANSITION: 'session:transition',
  ENGINE_ERROR: 'engine:error',
  ALERT: 'alert'
} as const;
export type EngineEventType =
  (typeof EngineEventType)[keyof typeof EngineEventType];

/** 엔진 이벤트 */
export interface EngineEvent {
  type: EngineEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * EventBus: 모듈 간 이벤트 통신 허브
 * - 개별 이벤트 타입으로 구독 가능
 * - '*' 와일드카드로 전체 이벤트 수신 (EventLogger용)
 */
export class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /** 이벤트 발행 */
  publish(event: EngineEvent): void {
    this.emit(event.type, event);
    this.emit('*', event);
  }

  /** 특정 이벤트 타입 구독 */
  subscribe(
    type: EngineEventType | '*',
    handler: (event: EngineEvent) => void
  ): void {
    this.on(type, handler);
  }

  /** 구독 해제 */
  unsubscribe(
    type: EngineEventType | '*',
    handler: (event: EngineEvent) => void
  ): void {
    this.off(type, handler);
  }
}
