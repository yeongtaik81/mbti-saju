import Database from 'better-sqlite3';
import path from 'node:path';
import {
  loadKisConfig,
  KisAuth,
  TokenBucketThrottler,
  KisRestClient,
  KisWsClient
} from './kis/index.js';
import { createSchema } from './db/schema.js';
import { EventBus } from './event/event-bus.js';
import { EventLogger } from './event/event-logger.js';
import { ConsoleAlertSink } from './event/alert-hook.js';
import { SessionManager } from './session/session-manager.js';
import type { EngineConfig } from './session/session-manager.js';

/**
 * TradingEngine: 모든 의존성 와이어링 + 라이프사이클 관리
 */
export class TradingEngine {
  private db: Database.Database | null = null;
  private eventBus: EventBus | null = null;
  private eventLogger: EventLogger | null = null;
  private sessionManager: SessionManager | null = null;
  private auth: KisAuth | null = null;

  /** 엔진 시작 */
  async start(config?: EngineConfig): Promise<void> {
    // DB 초기화
    const dbPath =
      process.env.DB_PATH || path.resolve(process.cwd(), 'data/trading.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    createSchema(this.db);

    // KIS 초기화
    const kisConfig = loadKisConfig();
    this.auth = new KisAuth(kisConfig);
    const throttler = new TokenBucketThrottler(20);
    const restClient = new KisRestClient(kisConfig, this.auth, throttler);
    // WS client: 접속키는 PRE_MARKET에서 auth.issueToken 후 발급
    const wsClient = new KisWsClient(kisConfig.wsBaseUrl, '');

    // EventBus + Logger
    this.eventBus = new EventBus();
    this.eventLogger = new EventLogger(this.db, this.eventBus);
    this.eventLogger.start();

    // AlertSink
    const alertSink = new ConsoleAlertSink();

    // SessionManager
    this.sessionManager = new SessionManager({
      db: this.db,
      auth: this.auth,
      restClient,
      wsClient,
      eventBus: this.eventBus,
      alertSink
    });

    if (config) {
      this.sessionManager.setConfig(config);
    }

    console.log('[TradingEngine] Started');
  }

  /** 엔진 정지 (graceful shutdown) */
  async stop(): Promise<void> {
    console.log('[TradingEngine] Stopping...');

    this.sessionManager?.destroy();
    this.eventLogger?.stop();
    this.auth?.destroy();
    this.db?.close();

    this.sessionManager = null;
    this.eventLogger = null;
    this.eventBus = null;
    this.auth = null;
    this.db = null;

    console.log('[TradingEngine] Stopped');
  }

  getSessionManager(): SessionManager | null {
    return this.sessionManager;
  }
}
