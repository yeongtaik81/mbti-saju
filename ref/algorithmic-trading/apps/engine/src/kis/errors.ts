/** KIS API 에러 기본 클래스 */
export class KisError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'KisError';
  }
}

/** KIS REST API 에러 (rt_cd ≠ "0" 또는 HTTP 에러) */
export class KisApiError extends KisError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly msgCd: string,
    public readonly msg1: string,
    public readonly rtCd: string
  ) {
    super(message, msgCd);
    this.name = 'KisApiError';
  }
}

/** KIS Rate Limit 에러 (429) */
export class KisRateLimitError extends KisApiError {
  constructor(
    message: string,
    public readonly retryAfterMs: number
  ) {
    super(message, 429, 'RATE_LIMIT', message, '1');
    this.name = 'KisRateLimitError';
  }
}

/** KIS 인증 에러 */
export class KisAuthError extends KisError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'KisAuthError';
  }
}

/** KIS WebSocket 에러 */
export class KisWsError extends KisError {
  constructor(message: string) {
    super(message, 'WS_ERROR');
    this.name = 'KisWsError';
  }
}
