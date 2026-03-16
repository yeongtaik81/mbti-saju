import type { KisConfig } from './config.js';
import { KisTokenResponseSchema, KisApprovalResponseSchema } from './types.js';
import { KisAuthError } from './errors.js';

/** 토큰 정보 */
interface TokenInfo {
  accessToken: string;
  expiresAt: number; // epoch ms
}

/** 지수 백오프 sleep */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * KIS 인증 관리
 * - 토큰 발급/갱신 (24h 유효, 만료 1시간 전 자동 갱신)
 * - WebSocket 접속키 발급
 * - 재발급 최소 60초 간격 제한
 */
export class KisAuth {
  private token: TokenInfo | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private lastIssuedAt = 0;
  private readonly config: KisConfig;
  private readonly fetchFn: typeof globalThis.fetch;

  /** 만료 전 버퍼 (5분) */
  private static readonly EXPIRY_BUFFER_MS = 5 * 60 * 1000;
  /** 자동 갱신 시점 (만료 1시간 전) */
  private static readonly REFRESH_BEFORE_MS = 60 * 60 * 1000;
  /** 재발급 최소 간격 (60초) */
  private static readonly MIN_ISSUE_INTERVAL_MS = 60 * 1000;
  /** 재시도 최대 횟수 */
  private static readonly MAX_RETRIES = 3;

  constructor(config: KisConfig, fetchFn?: typeof globalThis.fetch) {
    this.config = config;
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  /** 토큰 발급 */
  async issueToken(): Promise<string> {
    const now = Date.now();
    const elapsed = now - this.lastIssuedAt;
    if (elapsed < KisAuth.MIN_ISSUE_INTERVAL_MS && this.lastIssuedAt > 0) {
      throw new KisAuthError(
        `Token reissue too fast. Wait ${Math.ceil((KisAuth.MIN_ISSUE_INTERVAL_MS - elapsed) / 1000)}s`
      );
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt < KisAuth.MAX_RETRIES; attempt++) {
      try {
        const res = await this.fetchFn(
          `${this.config.restBaseUrl}/oauth2/tokenP`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              grant_type: 'client_credentials',
              appkey: this.config.appKey,
              appsecret: this.config.appSecret
            })
          }
        );

        if (!res.ok) {
          throw new KisAuthError(`Token issue failed: HTTP ${res.status}`);
        }

        const data = KisTokenResponseSchema.parse(await res.json());
        this.lastIssuedAt = Date.now();
        this.token = {
          accessToken: data.access_token,
          expiresAt: this.lastIssuedAt + data.expires_in * 1000
        };

        return data.access_token;
      } catch (err) {
        lastError = err as Error;
        if (attempt < KisAuth.MAX_RETRIES - 1) {
          await sleep(1000 * Math.pow(2, attempt)); // 1s, 2s, 4s
        }
      }
    }

    throw lastError ?? new KisAuthError('Token issue failed');
  }

  /** 현재 유효 토큰 반환 (없거나 만료 임박 시 발급) */
  async getToken(): Promise<string> {
    if (this.isTokenValid()) {
      return this.token!.accessToken;
    }
    return this.issueToken();
  }

  /** 토큰 유효성 검사 (만료 5분 전 버퍼) */
  isTokenValid(): boolean {
    if (!this.token) return false;
    return Date.now() < this.token.expiresAt - KisAuth.EXPIRY_BUFFER_MS;
  }

  /** 만료 1시간 전 자동 갱신 시작 */
  startAutoRefresh(): void {
    this.stopAutoRefresh();
    if (!this.token) return;

    const refreshAt = this.token.expiresAt - KisAuth.REFRESH_BEFORE_MS;
    const delay = Math.max(0, refreshAt - Date.now());

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.issueToken();
        this.startAutoRefresh();
      } catch (err) {
        console.error(
          '[KisAuth] Auto-refresh failed, will retry on next getToken():',
          err
        );
      }
    }, delay);
  }

  /** 자동 갱신 중지 */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /** WebSocket 접속키 발급 (재시도 포함) */
  async issueApprovalKey(): Promise<string> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < KisAuth.MAX_RETRIES; attempt++) {
      try {
        const res = await this.fetchFn(
          `${this.config.approvalUrl}/oauth2/Approval`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              grant_type: 'client_credentials',
              appkey: this.config.appKey,
              secretkey: this.config.appSecret
            })
          }
        );

        if (!res.ok) {
          throw new KisAuthError(
            `Approval key issue failed: HTTP ${res.status}`
          );
        }

        const data = KisApprovalResponseSchema.parse(await res.json());
        return data.approval_key;
      } catch (err) {
        lastError = err as Error;
        if (attempt < KisAuth.MAX_RETRIES - 1) {
          await sleep(1000 * Math.pow(2, attempt));
        }
      }
    }
    throw lastError ?? new KisAuthError('Approval key issue failed');
  }

  /** 정리 */
  destroy(): void {
    this.stopAutoRefresh();
    this.token = null;
  }
}
