/** 리스크 이벤트 유형 */
export const RiskEventType = {
  DAILY_LOSS_LIMIT: 'DAILY_LOSS_LIMIT',
  POSITION_LIMIT: 'POSITION_LIMIT',
  WEIGHT_LIMIT: 'WEIGHT_LIMIT',
  ORDER_REJECTED: 'ORDER_REJECTED',
  CAPITAL_LIMIT: 'CAPITAL_LIMIT'
} as const;
export type RiskEventType = (typeof RiskEventType)[keyof typeof RiskEventType];

/** 리스크 판정 결과 */
export const RiskAction = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAUSE_ENGINE: 'PAUSE_ENGINE',
  BLOCK_ORDER: 'BLOCK_ORDER'
} as const;
export type RiskAction = (typeof RiskAction)[keyof typeof RiskAction];

/** 리스크 판정 */
export interface RiskDecision {
  approved: boolean;
  action: RiskAction;
  reason: string;
  eventType?: RiskEventType;
}

/** 리스크 이벤트 로그 */
export interface RiskEvent {
  id: number;
  eventType: RiskEventType;
  detail: Record<string, unknown>;
  actionTaken: RiskAction;
  createdAt: string;
}
