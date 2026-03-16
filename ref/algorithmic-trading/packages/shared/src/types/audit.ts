/** 감사 로그 액터 */
export const AuditActor = {
  SYSTEM: 'system',
  USER: 'user'
} as const;
export type AuditActor = (typeof AuditActor)[keyof typeof AuditActor];

/** 감사 로그 액션 */
export const AuditAction = {
  STRATEGY_ON: 'STRATEGY_ON',
  STRATEGY_OFF: 'STRATEGY_OFF',
  PARAM_CHANGE: 'PARAM_CHANGE',
  FORCE_SELL: 'FORCE_SELL',
  ENGINE_START: 'ENGINE_START',
  ENGINE_STOP: 'ENGINE_STOP',
  ENV_SWITCH: 'ENV_SWITCH',
  SESSION_TRANSITION: 'SESSION_TRANSITION',
  RISK_LIMIT_HIT: 'RISK_LIMIT_HIT',
  RECONCILIATION_FAIL: 'RECONCILIATION_FAIL'
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/** 감사 로그 */
export interface AuditLog {
  id: number;
  actor: AuditActor;
  action: AuditAction;
  detail: Record<string, unknown>;
  createdAt: string;
}
