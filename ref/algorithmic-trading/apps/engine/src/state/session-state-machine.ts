import { SessionState } from '@trading/shared/types';

/** 장 시간 상태에서 허용되는 액션 */
export const SessionAction = {
  SCREENING: 'screening',
  INDICATOR_CALC: 'indicator_calc',
  WS_CONNECT: 'ws_connect',
  RECONCILIATION: 'reconciliation',
  WAIT_OPEN: 'wait_open',
  BUY: 'buy',
  SELL: 'sell',
  MONITOR: 'monitor',
  CANCEL_PENDING: 'cancel_pending',
  SETTLEMENT: 'settlement',
  REPORT: 'report',
  WS_DISCONNECT: 'ws_disconnect'
} as const;
export type SessionAction = (typeof SessionAction)[keyof typeof SessionAction];

/** 장 시간 상태 전이 규칙 */
const TRANSITIONS: Record<SessionState, SessionState[]> = {
  [SessionState.IDLE]: [SessionState.PRE_MARKET],
  [SessionState.PRE_MARKET]: [SessionState.OPENING_AUCTION, SessionState.IDLE],
  [SessionState.OPENING_AUCTION]: [SessionState.TRADING],
  [SessionState.TRADING]: [SessionState.PAUSED, SessionState.CLOSING],
  [SessionState.PAUSED]: [SessionState.TRADING, SessionState.CLOSING],
  [SessionState.CLOSING]: [SessionState.CLOSING_AUCTION],
  [SessionState.CLOSING_AUCTION]: [SessionState.POST_MARKET],
  [SessionState.POST_MARKET]: [SessionState.IDLE]
};

/** 각 상태에서 허용되는 동작 */
const ALLOWED_ACTIONS: Record<SessionState, Set<SessionAction>> = {
  [SessionState.IDLE]: new Set(),
  [SessionState.PRE_MARKET]: new Set([
    SessionAction.SCREENING,
    SessionAction.INDICATOR_CALC,
    SessionAction.WS_CONNECT,
    SessionAction.RECONCILIATION
  ]),
  [SessionState.OPENING_AUCTION]: new Set([SessionAction.WAIT_OPEN]),
  [SessionState.TRADING]: new Set([
    SessionAction.BUY,
    SessionAction.SELL,
    SessionAction.MONITOR
  ]),
  [SessionState.PAUSED]: new Set([SessionAction.SELL, SessionAction.MONITOR]),
  [SessionState.CLOSING]: new Set([SessionAction.SELL, SessionAction.MONITOR]),
  [SessionState.CLOSING_AUCTION]: new Set([
    SessionAction.SELL,
    SessionAction.CANCEL_PENDING,
    SessionAction.MONITOR
  ]),
  [SessionState.POST_MARKET]: new Set([
    SessionAction.SETTLEMENT,
    SessionAction.REPORT,
    SessionAction.WS_DISCONNECT
  ])
};

/** 상태 전이 콜백 */
export type OnSessionTransition = (
  from: SessionState,
  to: SessionState
) => void;

export class SessionStateMachine {
  private _state: SessionState;
  private _onTransition?: OnSessionTransition;

  constructor(
    initialState: SessionState = SessionState.IDLE,
    onTransition?: OnSessionTransition
  ) {
    this._state = initialState;
    this._onTransition = onTransition;
  }

  get state(): SessionState {
    return this._state;
  }

  /** 전이 가능 여부 */
  canTransition(to: SessionState): boolean {
    const allowed = TRANSITIONS[this._state];
    return allowed !== undefined && allowed.includes(to);
  }

  /** 상태 전이 */
  transition(to: SessionState): void {
    if (!this.canTransition(to)) {
      throw new Error(
        `Invalid session state transition: ${this._state} → ${to}`
      );
    }
    const from = this._state;
    this._state = to;
    this._onTransition?.(from, to);
  }

  /** 현재 상태에서 특정 액션이 허용되는지 */
  isActionAllowed(action: SessionAction): boolean {
    const actions = ALLOWED_ACTIONS[this._state];
    return actions !== undefined && actions.has(action);
  }

  /** 매수 가능 상태인지 */
  canBuy(): boolean {
    return this._state === SessionState.TRADING;
  }

  /** 매도 가능 상태인지 (CLOSING_AUCTION에서도 미체결 재주문 허용 [MF-2]) */
  canSell(): boolean {
    return (
      this._state === SessionState.TRADING ||
      this._state === SessionState.PAUSED ||
      this._state === SessionState.CLOSING ||
      this._state === SessionState.CLOSING_AUCTION
    );
  }

  /** 허용된 다음 상태 목록 */
  allowedTransitions(): SessionState[] {
    return TRANSITIONS[this._state] ?? [];
  }
}
