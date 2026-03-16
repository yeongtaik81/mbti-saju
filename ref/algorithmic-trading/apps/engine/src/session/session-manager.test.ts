import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { SessionState } from '@trading/shared/types';
import { SessionManager } from './session-manager.js';
import type { EngineConfig } from './session-manager.js';
import { EventBus, EngineEventType } from '../event/event-bus.js';
import type { EngineEvent } from '../event/event-bus.js';
import { createSchema } from '../db/schema.js';
import type { KisRestClient } from '../kis/rest-client.js';
import type { KisWsClient } from '../kis/ws-client.js';
import type { KisAuth } from '../kis/auth.js';
import type { AlertSink } from '../event/alert-hook.js';

function makeMockAuth(): KisAuth {
  return {
    issueToken: mock.fn(async () => {}),
    getToken: mock.fn(async () => 'mock-token'),
    destroy: mock.fn()
  } as unknown as KisAuth;
}

function makeMockRestClient(): KisRestClient {
  return {
    getCurrentPrice: mock.fn(async () => ({
      stck_prpr: '72000',
      stck_oprc: '71500',
      stck_hgpr: '72500',
      stck_lwpr: '71000',
      acml_vol: '15000000',
      acml_tr_pbmn: '1080000000000',
      hts_avls: '430000000000000',
      stck_mxpr: '93600',
      stck_llam: '50400'
    })),
    getDailyCandles: mock.fn(async () => []),
    getMinuteCandles: mock.fn(async () => []),
    getBalance: mock.fn(async () => ({
      items: [],
      summary: {
        dnca_tot_amt: '10000000',
        tot_evlu_amt: '10000000',
        pchs_amt_smtl_amt: '0',
        evlu_amt_smtl_amt: '0',
        evlu_pfls_smtl_amt: '0'
      }
    })),
    placeOrder: mock.fn(async () => ({
      kisOrderNo: 'KIS-001',
      orderTime: '100530'
    })),
    cancelOrder: mock.fn(async () => ({ kisOrderNo: 'KIS-C01' })),
    getExecutions: mock.fn(async () => []),
    getOpenOrders: mock.fn(async () => [])
  } as unknown as KisRestClient;
}

function makeMockWsClient(): KisWsClient {
  return {
    connect: mock.fn(async () => {}),
    disconnect: mock.fn(),
    subscribe: mock.fn(),
    on: mock.fn(),
    off: mock.fn()
  } as unknown as KisWsClient;
}

function makeMockAlertSink(): AlertSink {
  return { send: mock.fn(async () => {}) };
}

const defaultConfig: EngineConfig = {
  strategyParams: {
    k: 0.5,
    shortMaPeriod: 5,
    longMaPeriod: 20,
    rsiPeriod: 14,
    rsiLow: 30,
    rsiHigh: 70,
    stopLossRate: -0.03,
    takeProfitRate: 0.05,
    closingTime: '15:15'
  },
  riskParams: {
    maxPositions: 5,
    maxPositionWeight: 0.3,
    dailyLossLimit: -0.03,
    totalCapital: 10_000_000
  },
  screeningParams: {
    minMarketCap: 500_000_000_000,
    minVolumeAmount: 500_000_000_000,
    minPrice: 5000,
    maxPrice: 500000,
    maxCandidates: 10,
    markets: ['KOSPI', 'KOSDAQ']
  }
};

describe('SessionManager', () => {
  let db: Database.Database;
  let sm: SessionManager;
  let bus: EventBus;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    bus = new EventBus();

    sm = new SessionManager({
      db,
      auth: makeMockAuth(),
      restClient: makeMockRestClient(),
      wsClient: makeMockWsClient(),
      eventBus: bus,
      alertSink: makeMockAlertSink()
    });
    sm.setConfig(defaultConfig);
  });

  afterEach(() => {
    sm.destroy();
    db.close();
  });

  it('초기 상태는 IDLE이다', () => {
    assert.equal(sm.state, SessionState.IDLE);
  });

  it('PRE_MARKET 처리 후 PRE_MARKET 상태가 된다', async () => {
    const events: EngineEvent[] = [];
    bus.subscribe(EngineEventType.SESSION_TRANSITION, (e) => events.push(e));

    await sm.handlePreMarket();
    assert.equal(sm.state, SessionState.PRE_MARKET);
    assert.ok(events.length > 0);
  });

  it('설정 없이 PRE_MARKET 시 IDLE 유지', async () => {
    const sm2 = new SessionManager({
      db,
      auth: makeMockAuth(),
      restClient: makeMockRestClient(),
      wsClient: makeMockWsClient(),
      eventBus: bus,
      alertSink: makeMockAlertSink()
    });
    // setConfig 호출 안 함

    await sm2.handlePreMarket();
    assert.equal(sm2.state, SessionState.IDLE);
    sm2.destroy();
  });

  it('토큰 갱신 실패 시 IDLE로 복귀한다', async () => {
    const failAuth = {
      ...makeMockAuth(),
      issueToken: mock.fn(async () => {
        throw new Error('Auth failed');
      })
    } as unknown as KisAuth;

    const sm2 = new SessionManager({
      db,
      auth: failAuth,
      restClient: makeMockRestClient(),
      wsClient: makeMockWsClient(),
      eventBus: bus,
      alertSink: makeMockAlertSink()
    });
    sm2.setConfig(defaultConfig);

    await sm2.handlePreMarket();
    assert.equal(sm2.state, SessionState.IDLE);
    sm2.destroy();
  });

  it('[MF-6] 잔고 대사 실패 시 IDLE로 복귀한다', async () => {
    const failClient = {
      ...makeMockRestClient(),
      getBalance: mock.fn(async () => {
        throw new Error('Balance failed');
      })
    } as unknown as KisRestClient;

    const sm2 = new SessionManager({
      db,
      auth: makeMockAuth(),
      restClient: failClient,
      wsClient: makeMockWsClient(),
      eventBus: bus,
      alertSink: makeMockAlertSink()
    });
    sm2.setConfig(defaultConfig);

    await sm2.handlePreMarket();
    assert.equal(sm2.state, SessionState.IDLE);
    sm2.destroy();
  });

  it('PRE_MARKET → OPENING_AUCTION → TRADING 전이', async () => {
    await sm.handlePreMarket();
    assert.equal(sm.state, SessionState.PRE_MARKET);

    sm.handleOpeningAuction();
    assert.equal(sm.state, SessionState.OPENING_AUCTION);

    sm.startTrading();
    assert.equal(sm.state, SessionState.TRADING);
  });

  it('CLOSING → CLOSING_AUCTION → POST_MARKET → IDLE 전이', async () => {
    await sm.handlePreMarket();
    sm.handleOpeningAuction();
    sm.startTrading();

    await sm.handleClosing();
    assert.equal(sm.state, SessionState.CLOSING);

    await sm.handleClosingAuction();
    assert.equal(sm.state, SessionState.CLOSING_AUCTION);

    await sm.handlePostMarket();
    assert.equal(sm.state, SessionState.IDLE);
  });

  it('[MF-7] RISK_LIMIT_HIT 이벤트로 PAUSED 전이', async () => {
    await sm.handlePreMarket();
    sm.handleOpeningAuction();
    sm.startTrading();
    assert.equal(sm.state, SessionState.TRADING);

    bus.publish({
      type: EngineEventType.RISK_LIMIT_HIT,
      timestamp: new Date().toISOString(),
      data: { action: 'PAUSE_ENGINE', type: 'DAILY_LOSS_LIMIT' }
    });

    assert.equal(sm.state, SessionState.PAUSED);
  });

  it('휴장일/주말 감지', () => {
    // 주말 테스트
    assert.equal(sm.isWeekend('2026-03-07'), true); // Saturday
    assert.equal(sm.isWeekend('2026-03-05'), false); // Thursday

    // 휴장일 등록
    db.prepare(
      "INSERT INTO market_calendar (date, type, description) VALUES ('2026-03-01', 'HOLIDAY', '삼일절')"
    ).run();
    assert.equal(sm.isHoliday('2026-03-01'), true);
    assert.equal(sm.isHoliday('2026-03-02'), false);
  });
});
