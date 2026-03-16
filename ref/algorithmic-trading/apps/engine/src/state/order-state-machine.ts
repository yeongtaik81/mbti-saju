import { OrderStatus } from '@trading/shared/types';

/** 주문 상태 전이 규칙 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.SUBMITTED],
  [OrderStatus.SUBMITTED]: [OrderStatus.PENDING, OrderStatus.REJECTED],
  [OrderStatus.PENDING]: [
    OrderStatus.FILLED,
    OrderStatus.PARTIAL_FILLED,
    OrderStatus.REJECTED,
    OrderStatus.CANCEL_REQUESTED
  ],
  [OrderStatus.PARTIAL_FILLED]: [
    OrderStatus.FILLED,
    OrderStatus.CANCEL_REQUESTED
  ],
  [OrderStatus.FILLED]: [],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.CANCEL_REQUESTED]: [OrderStatus.CANCELLED, OrderStatus.FILLED],
  [OrderStatus.CANCELLED]: []
};

/** 종료 상태 (더 이상 전이 불가) */
const TERMINAL_STATES: Set<OrderStatus> = new Set([
  OrderStatus.FILLED,
  OrderStatus.REJECTED,
  OrderStatus.CANCELLED
]);

/** 상태 전이 콜백 */
export type OnOrderTransition = (from: OrderStatus, to: OrderStatus) => void;

export class OrderStateMachine {
  private _status: OrderStatus;
  private _onTransition?: OnOrderTransition;

  constructor(
    initialStatus: OrderStatus = OrderStatus.CREATED,
    onTransition?: OnOrderTransition
  ) {
    this._status = initialStatus;
    this._onTransition = onTransition;
  }

  get status(): OrderStatus {
    return this._status;
  }

  get isTerminal(): boolean {
    return TERMINAL_STATES.has(this._status);
  }

  /** 전이 가능 여부 확인 */
  canTransition(to: OrderStatus): boolean {
    const allowed = TRANSITIONS[this._status];
    return allowed !== undefined && allowed.includes(to);
  }

  /** 상태 전이 실행. 불가능하면 에러 */
  transition(to: OrderStatus): void {
    if (!this.canTransition(to)) {
      throw new Error(
        `Invalid order state transition: ${this._status} → ${to}`
      );
    }
    const from = this._status;
    this._status = to;
    this._onTransition?.(from, to);
  }

  /** 허용된 다음 상태 목록 */
  allowedTransitions(): OrderStatus[] {
    return TRANSITIONS[this._status] ?? [];
  }
}
