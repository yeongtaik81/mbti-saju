import type Database from 'better-sqlite3';
import { SessionState, MarketRegime } from '@trading/shared/types';
import type {
  StrategyParams,
  RiskParams,
  ScreeningParams,
  Signal,
  MarketRegime as MarketRegimeType
} from '@trading/shared/types';
import { DEFAULT_MARKET_HOURS } from '@trading/shared/constants';
import { SessionStateMachine } from '../state/session-state-machine.js';
import type { EventBus, EngineEvent } from '../event/event-bus.js';
import { EngineEventType } from '../event/event-bus.js';
import type { KisRestClient } from '../kis/rest-client.js';
import type { KisWsClient } from '../kis/ws-client.js';
import type { KisAuth } from '../kis/auth.js';
import { AutoScreener } from '../strategy/screener.js';
import { SignalGenerator } from '../strategy/signal-generator.js';
import type { StockIndicators } from '../strategy/signal-generator.js';
import { sma, rsi, atr } from '../strategy/indicators.js';
import { BreadthCalculator } from '../strategy/breadth.js';
import { countTradingDaysSince } from '../strategy/trading-days.js';
import { RiskManager } from '../order/risk-manager.js';
import { OrderManager } from '../order/order-manager.js';
import { PositionTracker } from '../order/position-tracker.js';
import type { AlertSink, AlertMessage } from '../event/alert-hook.js';
import type { Candle } from '@trading/shared/types';
import { toExecution } from '../kis/mappers.js';

/** 세션 매니저 의존성 */
export interface SessionManagerDeps {
  db: Database.Database;
  auth: KisAuth;
  restClient: KisRestClient;
  wsClient: KisWsClient;
  eventBus: EventBus;
  alertSink: AlertSink;
}

/** 전략/리스크 설정 */
export interface EngineConfig {
  strategyParams: StrategyParams;
  riskParams: RiskParams;
  screeningParams: ScreeningParams;
}

/**
 * SessionManager: 장 시간 기반 상태 전이 및 자동매매 오케스트레이션
 *
 * 상태별 핸들러:
 * - PRE_MARKET: 토큰 갱신, 잔고 대사, 스크리닝, 지표 계산, WS 연결, 리스크 초기화
 * - OPENING_AUCTION: 대기
 * - TRADING: 체결 폴링, WS tick → 신호 → 리스크 → 주문
 * - PAUSED: 매도만 허용 [MF-7]
 * - CLOSING: 전 포지션 시간청산 (intraday) / 스킵 (swing)
 * - CLOSING_AUCTION: 미체결 취소 → 시장가 재주문 [MF-2]
 * - POST_MARKET: 스냅샷, 일봉 수집, WS 해제
 */
export class SessionManager {
  private readonly sm: SessionStateMachine;
  private readonly db: Database.Database;
  private readonly auth: KisAuth;
  private readonly restClient: KisRestClient;
  private readonly wsClient: KisWsClient;
  private readonly eventBus: EventBus;
  private readonly alertSink: AlertSink;

  private screener: AutoScreener;
  private signalGenerator: SignalGenerator;
  private riskManager: RiskManager;
  private orderManager: OrderManager;
  private positionTracker: PositionTracker;
  private breadthCalculator: BreadthCalculator;

  private config: EngineConfig | null = null;
  private indicatorCache = new Map<string, StockIndicators>();
  private executionPollTimer: ReturnType<typeof setInterval> | null = null;
  private kisFailCount = 0; // [MF-5]
  private static readonly KIS_FAIL_THRESHOLD = 5;

  // 스윙 전략 전용
  private currentRegime: MarketRegimeType = MarketRegime.NEUTRAL;
  private currentBreadth = 0;
  private pendingOpenBuys: Signal[] = [];
  private holdingDaysCache = new Map<string, number>();

  constructor(deps: SessionManagerDeps) {
    this.db = deps.db;
    this.auth = deps.auth;
    this.restClient = deps.restClient;
    this.wsClient = deps.wsClient;
    this.eventBus = deps.eventBus;
    this.alertSink = deps.alertSink;

    this.sm = new SessionStateMachine(SessionState.IDLE, (from, to) => {
      this.eventBus.publish({
        type: EngineEventType.SESSION_TRANSITION,
        timestamp: new Date().toISOString(),
        data: { from, to }
      });
    });

    // 모듈 생성
    this.screener = new AutoScreener({
      db: this.db,
      restClient: this.restClient
    });
    this.signalGenerator = new SignalGenerator();
    this.riskManager = new RiskManager({
      db: this.db,
      eventBus: this.eventBus
    });
    this.orderManager = new OrderManager({
      db: this.db,
      restClient: this.restClient,
      riskManager: this.riskManager,
      eventBus: this.eventBus
    });
    this.positionTracker = new PositionTracker({
      db: this.db,
      eventBus: this.eventBus
    });
    this.breadthCalculator = new BreadthCalculator(this.db);

    // [MF-7] RISK_LIMIT_HIT → PAUSED
    this.eventBus.subscribe(EngineEventType.RISK_LIMIT_HIT, () => {
      if (this.sm.canTransition(SessionState.PAUSED)) {
        this.sm.transition(SessionState.PAUSED);
        this.sendAlert(
          'warn',
          'Risk Limit Hit',
          'Daily loss limit reached. Engine paused.'
        );
      }
    });
  }

  get state(): SessionState {
    return this.sm.state;
  }

  /** 전략 설정 */
  setConfig(config: EngineConfig): void {
    this.config = config;
  }

  private get isSwing(): boolean {
    return this.config?.strategyParams.strategyMode === 'swing';
  }

  /** PRE_MARKET 처리 */
  async handlePreMarket(): Promise<void> {
    // DB에서 최신 strategy_config 로드 (웹 UI에서 변경된 설정 반영)
    this.loadLatestConfig();

    if (!this.config) {
      this.sendAlert(
        'error',
        'No Config',
        'Strategy config not set. Staying IDLE.'
      );
      return;
    }

    if (!this.sm.canTransition(SessionState.PRE_MARKET)) return;
    this.sm.transition(SessionState.PRE_MARKET);

    // CRITICAL: 토큰 갱신
    try {
      await this.auth.issueToken();
    } catch (err) {
      this.sendAlert(
        'error',
        'Auth Failed',
        `Token refresh failed: ${(err as Error).message}`
      );
      this.sm.transition(SessionState.IDLE);
      return;
    }

    // CRITICAL: 잔고 대사 [MF-6]
    try {
      await this.restClient.getBalance();
    } catch (err) {
      this.sendAlert(
        'error',
        'Reconciliation Failed',
        `Balance check failed: ${(err as Error).message}`
      );
      this.sm.transition(SessionState.IDLE);
      return;
    }

    // 미체결 주문 복원 [SF-1]
    await this.orderManager.restoreActiveOrders();

    // NON-CRITICAL: 스크리닝
    try {
      const today = this.todayDate();
      await this.screener.screen(this.config.screeningParams, today);
    } catch (err) {
      this.sendAlert(
        'warn',
        'Screening Failed',
        `Using previous data: ${(err as Error).message}`
      );
    }

    // NON-CRITICAL: 지표 사전 계산
    try {
      this.precomputeIndicators();
    } catch (err) {
      this.sendAlert(
        'warn',
        'Indicator Calc Failed',
        `${(err as Error).message}`
      );
    }

    // 스윙 전략: breadth 계산 + 보유일 캐시 + 사전 매수 신호
    if (this.isSwing) {
      try {
        this.computeSwingPreMarket();
      } catch (err) {
        this.currentRegime = MarketRegime.NEUTRAL;
        this.pendingOpenBuys = [];
        this.sendAlert(
          'warn',
          'Swing Pre-Market Failed',
          `Defaulting to NEUTRAL regime: ${(err as Error).message}`
        );
      }
    }

    // 리스크/주문 일일 초기화
    this.riskManager.resetDailyState();
    this.orderManager.resetDailyState(); // [S1] processedExecutionKeys 정리

    // PositionTracker 시작
    this.positionTracker.start();

    // KIS 실패 카운트 초기화
    this.kisFailCount = 0;
  }

  /** OPENING_AUCTION → TRADING 전이 */
  handleOpeningAuction(): void {
    if (this.sm.canTransition(SessionState.OPENING_AUCTION)) {
      this.sm.transition(SessionState.OPENING_AUCTION);
    }
  }

  /** TRADING 시작 */
  startTrading(): void {
    if (this.sm.canTransition(SessionState.TRADING)) {
      this.sm.transition(SessionState.TRADING);
      this.startExecutionPolling();
    }
    // 스윙 pending buys는 handleTick에서 첫 tick 수신 시 실행 (시가 확정 후)
  }

  /**
   * WS tick 수신 시 매매 신호 평가
   * TRADING: 매수+매도 / PAUSED: 매도만 [MF-5,7]
   */
  handleTick(stockCode: string, price: number): void {
    if (!this.config) return;
    const state = this.sm.state;
    if (state !== SessionState.TRADING && state !== SessionState.PAUSED) return;

    const indicators = this.indicatorCache.get(stockCode);
    if (!indicators) return;

    // 당일 시가 확정: 첫 tick을 todayOpen으로 기록
    if (indicators.todayOpen <= 0) {
      indicators.todayOpen = price;
      // 스윙 BULL: 시가 확정 즉시 pending buy 실행
      if (this.isSwing && this.pendingOpenBuys.length > 0) {
        void this.executePendingOpenBuys();
      }
    }

    const positions = this.positionTracker.getOpenPositions();
    const positionMap = new Map(positions.map((p) => [p.stockCode, p]));
    const totalEquity =
      positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0) +
      this.getCash();
    const portfolio = {
      cash: this.getCash(),
      totalEquity,
      currentPositionCount: positions.length
    };

    // 매도 신호 평가 (항상)
    const existingPos = positionMap.get(stockCode);
    if (existingPos) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const sellSignal = this.signalGenerator.evaluateSell({
        stockCode,
        stockName: existingPos.stockName,
        currentPrice: price,
        buyPrice: existingPos.avgPrice,
        quantity: existingPos.quantity,
        indicators,
        strategyParams: this.config.strategyParams,
        currentTime,
        timestamp: new Date().toISOString(),
        holdingTradingDays: this.holdingDaysCache.get(stockCode)
      });

      if (sellSignal) {
        this.executeSignalSafe(sellSignal, totalEquity, positions);
      }
    }

    // 매수 신호 평가 (TRADING에서만)
    if (state === SessionState.TRADING && !existingPos) {
      // 스윙 BULL 레짐: 매수는 장 시작 시 이미 실행됨, tick에서 추가 매수 안 함
      if (this.isSwing && this.currentRegime === MarketRegime.BULL) return;

      const buySignal = this.signalGenerator.evaluateBuy({
        stockCode,
        stockName: stockCode,
        currentPrice: price,
        indicators,
        strategyParams: this.config.strategyParams,
        riskParams: this.config.riskParams,
        portfolio,
        timestamp: new Date().toISOString(),
        regime: this.isSwing ? this.currentRegime : undefined
      });

      if (buySignal) {
        this.executeSignalSafe(buySignal, totalEquity, positions);
      }
    }
  }

  /** CLOSING 처리: 전 포지션 시간청산 (intraday) / 스킵 (swing) */
  async handleClosing(): Promise<void> {
    if (this.sm.canTransition(SessionState.CLOSING)) {
      this.sm.transition(SessionState.CLOSING);
    }

    // 스윙 모드: 포지션 유지 (강제 청산 안 함)
    if (this.isSwing) return;

    // 인트라데이: 보유 포지션 전량 매도
    const positions = this.positionTracker.getOpenPositions();
    for (const pos of positions) {
      const signal: Signal = {
        stockCode: pos.stockCode,
        stockName: pos.stockName,
        side: 'sell',
        reason: 'time_exit',
        confidence: 1.0,
        price: pos.currentPrice,
        quantity: pos.quantity,
        paramsSnapshot: this.config?.strategyParams ?? ({} as StrategyParams),
        timestamp: new Date().toISOString()
      };

      const totalEquity =
        positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0) +
        this.getCash();
      await this.executeSignalSafe(signal, totalEquity, positions);
    }
  }

  /** CLOSING_AUCTION 처리: 미체결 취소 [MF-2] */
  async handleClosingAuction(): Promise<void> {
    if (this.sm.canTransition(SessionState.CLOSING_AUCTION)) {
      this.sm.transition(SessionState.CLOSING_AUCTION);
    }

    this.stopExecutionPolling();
    await this.orderManager.cancelAllPending();
  }

  /** POST_MARKET 처리: 정리 */
  async handlePostMarket(): Promise<void> {
    if (this.sm.canTransition(SessionState.POST_MARKET)) {
      this.sm.transition(SessionState.POST_MARKET);
    }

    // 스냅샷 저장
    const today = this.todayDate();
    const initialCapital = this.config?.riskParams.totalCapital ?? 0;
    this.positionTracker.saveSnapshot(today, this.getCash(), initialCapital);

    // 포지션 전량 청산 확인 (인트라데이만)
    if (!this.isSwing) {
      if (!this.positionTracker.verifyAllClosed()) {
        this.sendAlert(
          'warn',
          'Unclosed Positions',
          'Some positions remain open after market close.'
        );
      }
    }

    // PositionTracker 정지
    this.positionTracker.stop();

    // IDLE로 전이
    if (this.sm.canTransition(SessionState.IDLE)) {
      this.sm.transition(SessionState.IDLE);
    }
  }

  /** 휴장일 여부 확인 */
  isHoliday(date: string): boolean {
    const row = this.db
      .prepare(
        "SELECT type FROM market_calendar WHERE date = ? AND type = 'HOLIDAY'"
      )
      .get(date) as { type: string } | undefined;
    return !!row;
  }

  /** 주말 여부 */
  isWeekend(date: string): boolean {
    const d = new Date(date);
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  /** 리소스 정리 */
  destroy(): void {
    this.stopExecutionPolling();
    this.orderManager.destroy();
    this.positionTracker.stop();
  }

  // === private ===

  /** 스윙 PRE_MARKET 추가 로직: breadth + 보유일 + 사전 매수 */
  private computeSwingPreMarket(): void {
    if (!this.config) return;
    const sp = this.config.strategyParams;
    const today = this.todayDate();

    // 1. Breadth 계산 → 레짐 결정
    this.currentBreadth = this.breadthCalculator.computeBreadth(today, 20);
    this.currentRegime = this.breadthCalculator.getRegime(
      this.currentBreadth,
      sp.breadthBullThreshold ?? 0.5,
      sp.breadthBearThreshold ?? 0.4
    );
    console.log(
      `[Swing] Breadth: ${(this.currentBreadth * 100).toFixed(1)}%, Regime: ${this.currentRegime}`
    );

    // 2. 보유일 캐시
    // PRE_MARKET 시점에 당일 캔들은 아직 없으므로, 어제까지의 거래일 수 + 1 (오늘 거래일)
    this.holdingDaysCache.clear();
    const positions = this.positionTracker.getOpenPositions();
    for (const pos of positions) {
      const boughtDate = pos.boughtAt?.substring(0, 10) ?? today;
      const daysInDb = countTradingDaysSince(this.db, boughtDate, today);
      // 오늘이 거래일이면 +1 (PRE_MARKET 진입 = 오늘은 거래일)
      const holdDays = daysInDb + 1;
      this.holdingDaysCache.set(pos.stockCode, holdDays);
    }

    // 3. BULL 레짐: MA Support 사전 매수 신호 생성
    this.pendingOpenBuys = [];
    if (this.currentRegime === MarketRegime.BULL) {
      this.generatePendingOpenBuys();
    }
  }

  /** BULL 레짐: 어제 데이터 기준 MA Support 매수 후보 선정 */
  private generatePendingOpenBuys(): void {
    if (!this.config) return;
    const sp = this.config.strategyParams;
    const positions = this.positionTracker.getOpenPositions();
    const heldCodes = new Set(positions.map((p) => p.stockCode));

    const totalEquity =
      positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0) +
      this.getCash();

    for (const [stockCode, indicators] of this.indicatorCache) {
      if (heldCodes.has(stockCode)) continue;
      if (
        positions.length + this.pendingOpenBuys.length >=
        this.config.riskParams.maxPositions
      )
        break;

      // 이미 캐시된 지표로 MA Support 조건 평가
      if (indicators.shortMa === null || indicators.longMa === null) continue;
      if (indicators.shortMa <= indicators.longMa) continue;

      // prevClose가 longMA의 proximity% 이내
      const proximity = sp.maSupportProximity ?? 0.02;
      const prevClose = indicators.prevClose ?? 0;
      if (prevClose <= 0 || indicators.longMa <= 0) continue;
      const ratio = prevClose / indicators.longMa;
      if (ratio > 1 + proximity || ratio < 1 - proximity) continue;

      // VR 체크 (어제 거래량 기준, 데이터 부재 시 skip)
      const vrThreshold = sp.volumeRatioThreshold ?? 2.0;
      const avgVol = indicators.avgVolume20 ?? 0;
      const todayVol = indicators.todayVolume ?? 0;
      if (avgVol <= 0 || todayVol <= 0) continue;
      if (todayVol / avgVol < vrThreshold) continue;

      // 수량 계산 (시가 아직 모르므로 prevClose 기준 추정)
      const maxAllocation =
        totalEquity * this.config.riskParams.maxPositionWeight;
      const allocation = Math.min(maxAllocation, this.getCash());
      const quantity = Math.floor(allocation / prevClose);
      if (quantity <= 0) continue;

      this.pendingOpenBuys.push({
        stockCode,
        stockName: stockCode,
        side: 'buy',
        reason: 'ma_support',
        confidence: 1.0,
        price: prevClose, // 실제 실행 시 시가로 교체
        quantity,
        paramsSnapshot: sp,
        timestamp: new Date().toISOString()
      });
    }

    if (this.pendingOpenBuys.length > 0) {
      console.log(
        `[Swing] BULL pending buys: ${this.pendingOpenBuys.length}건`
      );
    }
  }

  /** 장 시작 시 대기 중인 MA Support 매수 실행 */
  private async executePendingOpenBuys(): Promise<void> {
    const positions = this.positionTracker.getOpenPositions();
    const totalEquity =
      positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0) +
      this.getCash();

    let remainingCash = this.getCash();
    const maxWeight = this.config?.riskParams.maxPositionWeight ?? 0.3;

    for (const signal of this.pendingOpenBuys) {
      // 시가로 교체 (첫 tick에서 확정된 todayOpen 사용)
      const indicators = this.indicatorCache.get(signal.stockCode);
      if (indicators && indicators.todayOpen > 0) {
        signal.price = indicators.todayOpen;
      } else {
        // 시가 미확정 시 skip (장 시작 전 실행 방지)
        continue;
      }

      // 가용 현금 기준으로 수량 재계산 (현금 초과 방지)
      const maxAllocation = totalEquity * maxWeight;
      const allocation = Math.min(maxAllocation, remainingCash);
      signal.quantity = Math.floor(allocation / signal.price);
      if (signal.quantity <= 0) continue;

      await this.executeSignalSafe(signal, totalEquity, positions);
      remainingCash -= signal.quantity * signal.price;
      if (remainingCash <= 0) break;
    }
    this.pendingOpenBuys = [];
  }

  /**
   * [M3] OrderManager.executeSignal은 내부에서 catch하여 null을 반환하므로,
   * 반환값으로 성공/실패를 판단한다 (throw하지 않음).
   * null 반환 사유: 리스크 거부, 중복 주문, KIS API 실패 등
   * KIS API 실패만 카운트하기 위해 OrderManager에 lastError 추적 추가.
   */
  private async executeSignalSafe(
    signal: Signal,
    totalEquity: number,
    positions: Array<{
      stockCode: string;
      currentPrice: number;
      quantity: number;
    }>
  ): Promise<void> {
    const stockValues = new Map(
      positions.map((p) => [p.stockCode, p.currentPrice * p.quantity])
    );
    const portfolio = {
      cash: this.getCash(),
      totalEquity,
      positionCount: positions.length,
      stockValues
    };
    const riskParams = this.config?.riskParams ?? {
      maxPositions: 5,
      maxPositionWeight: 0.3,
      dailyLossLimit: -0.03,
      totalCapital: 10_000_000
    };

    const result = await this.orderManager.executeSignal(
      signal,
      portfolio,
      riskParams
    );
    if (result !== null) {
      // 주문 성공 (KIS 접수 완료)
      this.kisFailCount = 0;
    } else if (this.orderManager.lastFailureReason === 'KIS_ERROR') {
      // [M3] KIS API 실패 시에만 카운트
      this.kisFailCount++;
      if (
        this.kisFailCount >= SessionManager.KIS_FAIL_THRESHOLD &&
        this.sm.canTransition(SessionState.PAUSED)
      ) {
        this.sm.transition(SessionState.PAUSED);
        this.sendAlert(
          'error',
          'KIS API Failure',
          `${this.kisFailCount} consecutive failures. Engine paused.`
        );
      }
    }
    // 리스크 거부/중복 주문 등은 KIS 장애가 아니므로 카운트하지 않음
  }

  /** 체결 폴링 시작 (3초) */
  private startExecutionPolling(): void {
    if (this.executionPollTimer) return;
    this.executionPollTimer = setInterval(() => this.pollExecutions(), 3000);
  }

  private stopExecutionPolling(): void {
    if (this.executionPollTimer) {
      clearInterval(this.executionPollTimer);
      this.executionPollTimer = null;
    }
  }

  private async pollExecutions(): Promise<void> {
    try {
      const executions = await this.restClient.getExecutions();
      for (const exec of executions) {
        const mapped = toExecution(exec);
        if (mapped.filledQuantity > 0) {
          // [M2] 실제 체결가 = 체결금액 / 체결수량 (pchs_avg_pric는 매입평균가, 체결가가 아님)
          const actualFillPrice =
            mapped.filledQuantity > 0
              ? mapped.filledAmount / mapped.filledQuantity
              : mapped.avgPrice;

          this.orderManager.handleExecution({
            kisOrderNo: mapped.kisOrderNo,
            stockCode: mapped.stockCode,
            side: mapped.side,
            filledQuantity: mapped.filledQuantity,
            filledPrice: actualFillPrice,
            filledAmount: mapped.filledAmount,
            executedAt: mapped.orderTime
          });
        }
      }
    } catch (err) {
      // [S3] 에러 로깅 추가
      console.error(
        '[SessionManager] pollExecutions failed:',
        err instanceof Error ? err.message : err
      );
    }
  }

  /** 일봉 기반 지표 사전 계산 */
  private precomputeIndicators(): void {
    if (!this.config) return;
    this.indicatorCache.clear();

    const today = this.todayDate();
    const candidates = this.screener.getLatestResults(today);

    for (const c of candidates) {
      const candles = this.db
        .prepare(
          `
        SELECT stock_code, date, open, high, low, close, volume, COALESCE(amount,0) as amount
        FROM daily_candles
        WHERE stock_code = ? AND date <= ?
        ORDER BY date DESC LIMIT 60
      `
        )
        .all(c.stockCode, today) as Candle[];

      if (candles.length < 2) continue;

      const sorted = candles.reverse();
      const sp = this.config.strategyParams;

      const shortMaArr = sma(sorted, sp.shortMaPeriod);
      const longMaArr = sma(sorted, sp.longMaPeriod);
      const rsiArr = rsi(sorted, sp.rsiPeriod);

      const last = sorted.length - 1;
      const prev = sorted[last - 1];
      const current = sorted[last];

      if (!prev || !current) continue;

      // 20일 평균 거래량
      const volCandles = sorted.slice(Math.max(0, sorted.length - 20));
      const avgVolume20 =
        volCandles.length > 0
          ? volCandles.reduce((sum, c) => sum + c.volume, 0) / volCandles.length
          : 0;

      this.indicatorCache.set(c.stockCode, {
        todayOpen: 0, // 당일 시가는 장 시작 시 첫 tick으로 갱신 (PRE_MARKET에서는 미확정)
        prevHigh: prev.high,
        prevLow: prev.low,
        shortMa: shortMaArr[last] ?? null,
        longMa: longMaArr[last] ?? null,
        currentRsi: rsiArr[last] ?? null,
        prevClose: current.close, // 마지막 캔들의 close = 전일 종가
        avgVolume20,
        todayVolume: current.volume // PRE_MARKET에서는 어제 거래량 (VR 사전 평가용)
      });
    }
  }

  private getCash(): number {
    const snap = this.db
      .prepare(
        `
      SELECT cash FROM portfolio_snapshots ORDER BY date DESC LIMIT 1
    `
      )
      .get() as { cash: number } | undefined;
    return snap?.cash ?? this.config?.riskParams.totalCapital ?? 0;
  }

  /** DB에서 최신 strategy_config를 로드하여 config에 반영 */
  private loadLatestConfig(): void {
    try {
      // 활성화(enabled=1)된 최신 전략을 로드, 없으면 기존 config 유지
      const row = this.db
        .prepare(
          'SELECT params, risk_params, screening_params FROM strategy_config WHERE enabled = 1 ORDER BY id DESC LIMIT 1'
        )
        .get() as
        | { params: string; risk_params: string; screening_params: string }
        | undefined;

      if (!row) return;

      const params = JSON.parse(row.params) as StrategyParams;
      const riskParams = JSON.parse(row.risk_params) as RiskParams;
      const screeningParams = JSON.parse(
        row.screening_params
      ) as ScreeningParams;
      this.config = { strategyParams: params, riskParams, screeningParams };
    } catch (err) {
      console.error(
        '[SessionManager] loadLatestConfig failed:',
        err instanceof Error ? err.message : err
      );
    }
  }

  private todayDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private sendAlert(
    level: AlertMessage['level'],
    title: string,
    body: string
  ): void {
    this.alertSink
      .send({
        level,
        title,
        body,
        timestamp: new Date().toISOString()
      })
      .catch(() => {});
  }
}
