import type Database from 'better-sqlite3';
import type {
  Signal,
  RiskDecision,
  RiskAction,
  RiskEventType,
  RiskParams
} from '@trading/shared/types';
import type { EventBus } from '../event/event-bus.js';
import { EngineEventType } from '../event/event-bus.js';

/**
 * RiskManager: 주문 전 리스크 검증
 * 체인 검증 (첫 거부 시 short-circuit)
 */
export class RiskManager {
  private readonly db: Database.Database;
  private readonly eventBus: EventBus;
  private dailyLossBlocked = false;
  private readonly dailyBlacklist = new Set<string>(); // [SF-3] 종목 당일 블랙리스트

  constructor(deps: { db: Database.Database; eventBus: EventBus }) {
    this.db = deps.db;
    this.eventBus = deps.eventBus;
  }

  /** 매수 주문 리스크 검증 */
  checkBuyOrder(
    signal: Signal,
    riskParams: RiskParams,
    portfolio: {
      cash: number;
      totalEquity: number;
      positionCount: number;
      stockValues: Map<string, number>;
    }
  ): RiskDecision {
    const now = new Date().toISOString();

    // 1. dailyLossBlocked → BLOCK_ORDER
    if (this.dailyLossBlocked) {
      return this.reject(
        'BLOCK_ORDER',
        'DAILY_LOSS_LIMIT',
        'Daily loss limit already triggered'
      );
    }

    // 2. 일일 최대 손실 확인 [MF-7]
    const dailyPnlRate = this.getDailyPnlRate(
      portfolio.totalEquity,
      riskParams.totalCapital
    );
    if (dailyPnlRate <= riskParams.dailyLossLimit) {
      this.dailyLossBlocked = true;
      // RISK_LIMIT_HIT 이벤트 발행 → SessionManager가 PAUSED 전이
      this.eventBus.publish({
        type: EngineEventType.RISK_LIMIT_HIT,
        timestamp: now,
        data: { action: 'PAUSE_ENGINE', type: 'DAILY_LOSS_LIMIT', dailyPnlRate }
      });
      return this.reject(
        'PAUSE_ENGINE',
        'DAILY_LOSS_LIMIT',
        `Daily loss ${(dailyPnlRate * 100).toFixed(2)}% exceeds limit`
      );
    }

    // 3. 최대 보유 종목 수
    if (portfolio.positionCount >= riskParams.maxPositions) {
      return this.reject(
        'REJECTED',
        'POSITION_LIMIT',
        `Position count ${portfolio.positionCount} >= max ${riskParams.maxPositions}`
      );
    }

    // 4. 종목당 최대 비중
    const orderAmount = signal.price * signal.quantity;
    const currentStockValue = portfolio.stockValues.get(signal.stockCode) ?? 0;
    const newWeight = (currentStockValue + orderAmount) / portfolio.totalEquity;
    if (newWeight > riskParams.maxPositionWeight) {
      return this.reject(
        'REJECTED',
        'WEIGHT_LIMIT',
        `Weight ${(newWeight * 100).toFixed(1)}% exceeds max ${(riskParams.maxPositionWeight * 100).toFixed(1)}%`
      );
    }

    // 5. 총 투자금 한도
    if (orderAmount > portfolio.cash) {
      return this.reject(
        'REJECTED',
        'CAPITAL_LIMIT',
        `Order amount ${orderAmount} exceeds cash ${portfolio.cash}`
      );
    }

    // 6. 중복 주문
    if (this.hasActiveOrder(signal.stockCode, 'buy')) {
      return this.reject(
        'REJECTED',
        'ORDER_REJECTED',
        `Duplicate buy order for ${signal.stockCode}`
      );
    }

    // 7. [SF-3] 종목 당일 블랙리스트
    if (this.dailyBlacklist.has(signal.stockCode)) {
      return this.reject(
        'REJECTED',
        'ORDER_REJECTED',
        `${signal.stockCode} is blacklisted today`
      );
    }

    // All pass
    this.eventBus.publish({
      type: EngineEventType.RISK_APPROVED,
      timestamp: now,
      data: { action: 'APPROVED', stockCode: signal.stockCode, side: 'buy' }
    });

    return {
      approved: true,
      action: 'APPROVED',
      reason: 'All risk checks passed'
    };
  }

  /** 매도 주문 리스크 검증 (중복 체크만, 매도는 항상 허용) */
  checkSellOrder(signal: Signal): RiskDecision {
    if (this.hasActiveOrder(signal.stockCode, 'sell')) {
      return this.reject(
        'REJECTED',
        'ORDER_REJECTED',
        `Duplicate sell order for ${signal.stockCode}`
      );
    }

    return {
      approved: true,
      action: 'APPROVED',
      reason: 'Sell order approved'
    };
  }

  /** 매일 초기화 */
  resetDailyState(): void {
    this.dailyLossBlocked = false;
    this.dailyBlacklist.clear();
  }

  /** [SF-3] 종목 블랙리스트 등록 */
  addToBlacklist(stockCode: string): void {
    this.dailyBlacklist.add(stockCode);
  }

  /** 일일 P&L 비율 계산 */
  private getDailyPnlRate(
    currentEquity: number,
    initialCapital: number
  ): number {
    // 간단 계산: (현재 자산 - 초기 자본) / 초기 자본
    // 실제로는 당일 시작 시점 자산 대비 계산해야 하나, 일단 initialCapital 기준
    return (currentEquity - initialCapital) / initialCapital;
  }

  /** 해당 종목의 활성 주문 존재 여부 */
  private hasActiveOrder(stockCode: string, side: string): boolean {
    const row = this.db
      .prepare(
        `
      SELECT COUNT(*) as cnt FROM orders
      WHERE stock_code = ? AND side = ?
      AND status IN ('CREATED', 'SUBMITTED', 'PENDING', 'PARTIAL_FILLED')
    `
      )
      .get(stockCode, side) as { cnt: number } | undefined;
    return (row?.cnt ?? 0) > 0;
  }

  private reject(
    action: RiskAction,
    eventType: RiskEventType,
    reason: string
  ): RiskDecision {
    this.eventBus.publish({
      type: EngineEventType.RISK_REJECTED,
      timestamp: new Date().toISOString(),
      data: { action, eventType, reason }
    });
    return {
      approved: false,
      action,
      reason,
      eventType
    };
  }
}
