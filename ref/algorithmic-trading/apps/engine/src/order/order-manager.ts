import type Database from 'better-sqlite3';
import type {
  Signal,
  OrderStatus,
  OrderSide,
  OrderType
} from '@trading/shared/types';
import { adjustBuyPrice, adjustSellPrice } from '@trading/shared/constants';
import { OrderStateMachine } from '../state/order-state-machine.js';
import type { KisRestClient } from '../kis/rest-client.js';
import type { RiskManager } from './risk-manager.js';
import type { EventBus } from '../event/event-bus.js';
import { EngineEventType } from '../event/event-bus.js';

/** 활성 주문 추적 */
interface ActiveOrder {
  orderId: string;
  stockCode: string;
  side: OrderSide;
  kisOrderNo: string | null;
  status: OrderStatus;
  sm: OrderStateMachine;
}

/**
 * OrderManager: 주문 실행 및 체결 관리
 * [MF-1] orders, executions 테이블의 유일한 writer
 * [MF-8] Race condition 방지: executeSignal 시작 시 즉시 activeOrders에 lock 등록
 * [MF-3] 체결 dedup: processedExecutionKeys Set
 */
/** 주문 실패 사유 구분 [M3] */
export type OrderFailureReason =
  | 'KIS_ERROR'
  | 'RISK_REJECTED'
  | 'DUPLICATE'
  | null;

export class OrderManager {
  private readonly db: Database.Database;
  private readonly restClient: KisRestClient;
  private readonly riskManager: RiskManager;
  private readonly eventBus: EventBus;
  private readonly activeOrders = new Map<string, ActiveOrder>();
  private readonly processedExecutionKeys = new Set<string>(); // [MF-3]
  private partialFillTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** [M3] 마지막 실패 사유 — SessionManager가 KIS 장애를 구분하기 위해 사용 */
  lastFailureReason: OrderFailureReason = null;

  private readonly insertOrder: Database.Statement;
  private readonly updateOrderStatus: Database.Statement;
  private readonly updateOrderFill: Database.Statement;
  private readonly insertExecution: Database.Statement;

  constructor(deps: {
    db: Database.Database;
    restClient: KisRestClient;
    riskManager: RiskManager;
    eventBus: EventBus;
  }) {
    this.db = deps.db;
    this.restClient = deps.restClient;
    this.riskManager = deps.riskManager;
    this.eventBus = deps.eventBus;

    this.insertOrder = this.db.prepare(`
      INSERT INTO orders (order_id, stock_code, stock_name, side, order_type, quantity, price, status, strategy, signal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.updateOrderStatus = this.db.prepare(`
      UPDATE orders SET status = ?, updated_at = datetime('now','localtime')
      WHERE order_id = ?
    `);

    this.updateOrderFill = this.db.prepare(`
      UPDATE orders SET status = ?, filled_quantity = ?, filled_price = ?,
        kis_order_no = ?, updated_at = datetime('now','localtime')
      WHERE order_id = ?
    `);

    this.insertExecution = this.db.prepare(`
      INSERT OR IGNORE INTO executions (order_id, stock_code, side, quantity, price, amount, fee, tax, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  /**
   * 신호 → 주문 실행
   * [MF-8] 즉시 activeOrders에 lock 등록
   */
  async executeSignal(
    signal: Signal,
    portfolio: {
      cash: number;
      totalEquity: number;
      positionCount: number;
      stockValues: Map<string, number>;
    },
    riskParams: {
      maxPositions: number;
      maxPositionWeight: number;
      dailyLossLimit: number;
      totalCapital: number;
    }
  ): Promise<string | null> {
    const orderId = this.generateOrderId();

    // [MF-8] 즉시 lock
    if (this.hasActiveOrder(signal.stockCode, signal.side)) {
      this.lastFailureReason = 'DUPLICATE';
      return null; // 이미 처리 중
    }

    const sm = new OrderStateMachine();
    const activeOrder: ActiveOrder = {
      orderId,
      stockCode: signal.stockCode,
      side: signal.side,
      kisOrderNo: null,
      status: 'CREATED',
      sm
    };
    this.activeOrders.set(orderId, activeOrder);

    try {
      // 리스크 체크
      const riskDecision =
        signal.side === 'buy'
          ? this.riskManager.checkBuyOrder(signal, riskParams, portfolio)
          : this.riskManager.checkSellOrder(signal);

      if (!riskDecision.approved) {
        this.activeOrders.delete(orderId);
        this.lastFailureReason = 'RISK_REJECTED';
        return null;
      }

      // 호가 보정
      const adjustedPrice =
        signal.side === 'buy'
          ? adjustBuyPrice(signal.price)
          : adjustSellPrice(signal.price);

      const orderType: OrderType = 'LIMIT';

      // DB INSERT (CREATED)
      this.insertOrder.run(
        orderId,
        signal.stockCode,
        signal.stockName,
        signal.side,
        orderType,
        signal.quantity,
        adjustedPrice,
        'CREATED',
        'volatility_breakout',
        signal.reason
      );

      this.eventBus.publish({
        type: EngineEventType.ORDER_CREATED,
        timestamp: new Date().toISOString(),
        data: {
          orderId,
          stockCode: signal.stockCode,
          side: signal.side,
          quantity: signal.quantity,
          price: adjustedPrice
        }
      });

      // KIS 주문 실행
      sm.transition('SUBMITTED');
      this.updateOrderStatus.run('SUBMITTED', orderId);

      const result = await this.restClient.placeOrder({
        side: signal.side,
        stockCode: signal.stockCode,
        orderType,
        quantity: signal.quantity,
        price: adjustedPrice
      });

      sm.transition('PENDING');
      activeOrder.kisOrderNo = result.kisOrderNo;
      activeOrder.status = 'PENDING';
      this.updateOrderFill.run('PENDING', 0, 0, result.kisOrderNo, orderId);

      this.eventBus.publish({
        type: EngineEventType.ORDER_SUBMITTED,
        timestamp: new Date().toISOString(),
        data: {
          orderId,
          kisOrderNo: result.kisOrderNo,
          stockCode: signal.stockCode
        }
      });

      this.lastFailureReason = null; // 성공
      return orderId;
    } catch (err) {
      // 주문 실패 → REJECTED
      try {
        sm.transition('SUBMITTED');
        sm.transition('REJECTED');
      } catch {
        // 상태 전이 실패는 무시
      }
      this.updateOrderStatus.run('REJECTED', orderId);
      this.activeOrders.delete(orderId);
      this.lastFailureReason = 'KIS_ERROR'; // [M3]

      // [SF-3] 주문 거부 시 블랙리스트
      this.riskManager.addToBlacklist(signal.stockCode);

      this.eventBus.publish({
        type: EngineEventType.ORDER_REJECTED,
        timestamp: new Date().toISOString(),
        data: {
          orderId,
          stockCode: signal.stockCode,
          reason: err instanceof Error ? err.message : 'Unknown error'
        }
      });

      return null;
    }
  }

  /**
   * 체결 처리
   * [MF-3] dedup: processedExecutionKeys Set
   * [M4] 증분(delta) 계산: KIS API는 누적 체결수량을 반환하므로,
   *   DB의 기존 filled_quantity와의 차이를 executions에 기록한다.
   * [S2] dedup 키에 stockCode 포함
   */
  handleExecution(params: {
    kisOrderNo: string;
    stockCode: string;
    side: OrderSide;
    filledQuantity: number;
    filledPrice: number;
    filledAmount: number;
    executedAt: string;
  }): void {
    // [MF-3][S2] dedup — stockCode 포함
    const execKey = `${params.kisOrderNo}:${params.stockCode}:${params.filledQuantity}:${params.filledPrice}`;
    if (this.processedExecutionKeys.has(execKey)) return;
    this.processedExecutionKeys.add(execKey);

    // kisOrderNo로 활성 주문 찾기
    const activeOrder = this.findByKisOrderNo(params.kisOrderNo);
    if (!activeOrder) return;

    const { orderId, sm } = activeOrder;

    // DB에서 현재 주문 정보
    const orderRow = this.db
      .prepare(
        'SELECT quantity, filled_quantity FROM orders WHERE order_id = ?'
      )
      .get(orderId) as
      | { quantity: number; filled_quantity: number }
      | undefined;
    if (!orderRow) return;

    const totalFilledQty = params.filledQuantity;
    const isFullyFilled = totalFilledQty >= orderRow.quantity;

    // [M4] 증분 계산: 이번 체결분 = 누적 체결수량 - 이전 체결수량
    const prevFilledQty = orderRow.filled_quantity ?? 0;
    const deltaQty = totalFilledQty - prevFilledQty;
    if (deltaQty <= 0) return; // 이미 처리됨

    const deltaAmount = deltaQty * params.filledPrice;
    const fee = deltaAmount * 0.00015; // 증권사 수수료
    const tax = activeOrder.side === 'sell' ? deltaAmount * 0.0018 : 0;

    // 체결 기록 (증분 기준)
    this.insertExecution.run(
      orderId,
      params.stockCode,
      activeOrder.side,
      deltaQty,
      params.filledPrice,
      deltaAmount,
      fee,
      tax,
      params.executedAt
    );

    if (isFullyFilled) {
      // 전량 체결
      if (sm.canTransition('FILLED')) {
        sm.transition('FILLED');
      }
      this.updateOrderFill.run(
        'FILLED',
        totalFilledQty,
        params.filledPrice,
        params.kisOrderNo,
        orderId
      );
      this.activeOrders.delete(orderId);
      this.clearPartialFillTimer(orderId);

      this.eventBus.publish({
        type: EngineEventType.ORDER_FILLED,
        timestamp: new Date().toISOString(),
        data: {
          orderId,
          stockCode: params.stockCode,
          side: activeOrder.side,
          filledQuantity: totalFilledQty,
          filledPrice: params.filledPrice
        }
      });
    } else {
      // 부분 체결 [MF-4]
      if (sm.canTransition('PARTIAL_FILLED')) {
        sm.transition('PARTIAL_FILLED');
      }
      this.updateOrderFill.run(
        'PARTIAL_FILLED',
        totalFilledQty,
        params.filledPrice,
        params.kisOrderNo,
        orderId
      );
      activeOrder.status = 'PARTIAL_FILLED';

      this.eventBus.publish({
        type: EngineEventType.ORDER_PARTIAL_FILLED,
        timestamp: new Date().toISOString(),
        data: {
          orderId,
          stockCode: params.stockCode,
          side: activeOrder.side,
          filledQuantity: totalFilledQty,
          filledPrice: params.filledPrice,
          remainingQuantity: orderRow.quantity - totalFilledQty
        }
      });

      // 30초 후 미체결 잔량 취소
      this.schedulePartialFillCancel(
        activeOrder,
        orderRow.quantity - totalFilledQty
      );
    }
  }

  /** 전체 미체결 주문 취소 (장 마감 시) */
  async cancelAllPending(): Promise<void> {
    const pendingOrders = Array.from(this.activeOrders.values()).filter(
      (o) => !o.sm.isTerminal && o.kisOrderNo
    );

    for (const order of pendingOrders) {
      try {
        if (order.sm.canTransition('CANCEL_REQUESTED')) {
          order.sm.transition('CANCEL_REQUESTED');
        }
        this.updateOrderStatus.run('CANCEL_REQUESTED', order.orderId);

        await this.restClient.cancelOrder({
          orgOrderNo: order.kisOrderNo!,
          stockCode: order.stockCode,
          quantity: 0 // 전량
        });

        if (order.sm.canTransition('CANCELLED')) {
          order.sm.transition('CANCELLED');
        }
        this.updateOrderStatus.run('CANCELLED', order.orderId);
        this.activeOrders.delete(order.orderId);

        this.eventBus.publish({
          type: EngineEventType.ORDER_CANCELLED,
          timestamp: new Date().toISOString(),
          data: { orderId: order.orderId, stockCode: order.stockCode }
        });
      } catch {
        // 개별 취소 실패 → 다음으로 진행
      }
    }
  }

  /** 재시작 시 미체결 주문 복원 [SF-1] */
  async restoreActiveOrders(): Promise<void> {
    try {
      const openOrders = await this.restClient.getOpenOrders();
      for (const kisOrder of openOrders) {
        const side: OrderSide =
          kisOrder.sll_buy_dvsn_cd === '02' ? 'buy' : 'sell';
        const status: OrderStatus =
          Number(kisOrder.tot_ccld_qty) > 0 ? 'PARTIAL_FILLED' : 'PENDING';
        const sm = new OrderStateMachine('PENDING');
        if (status === 'PARTIAL_FILLED') {
          sm.transition('PARTIAL_FILLED');
        }

        // DB에서 매칭되는 주문 찾기
        const dbOrder = this.db
          .prepare('SELECT order_id FROM orders WHERE kis_order_no = ?')
          .get(kisOrder.odno) as { order_id: string } | undefined;

        if (dbOrder) {
          this.activeOrders.set(dbOrder.order_id, {
            orderId: dbOrder.order_id,
            stockCode: kisOrder.pdno,
            side,
            kisOrderNo: kisOrder.odno,
            status,
            sm
          });
        }
      }
    } catch {
      // 복원 실패 → 로깅만
      console.error('[OrderManager] Failed to restore active orders');
    }
  }

  /** [S1] 일일 초기화 — processedExecutionKeys 정리 */
  resetDailyState(): void {
    this.processedExecutionKeys.clear();
  }

  /** 리소스 정리 */
  destroy(): void {
    for (const timer of this.partialFillTimers.values()) {
      clearTimeout(timer);
    }
    this.partialFillTimers.clear();
    this.activeOrders.clear();
    this.processedExecutionKeys.clear();
  }

  getActiveOrders(): Map<string, ActiveOrder> {
    return this.activeOrders;
  }

  private hasActiveOrder(stockCode: string, side: OrderSide): boolean {
    for (const order of this.activeOrders.values()) {
      if (
        order.stockCode === stockCode &&
        order.side === side &&
        !order.sm.isTerminal
      ) {
        return true;
      }
    }
    return false;
  }

  private findByKisOrderNo(kisOrderNo: string): ActiveOrder | undefined {
    for (const order of this.activeOrders.values()) {
      if (order.kisOrderNo === kisOrderNo) return order;
    }
    return undefined;
  }

  private schedulePartialFillCancel(
    order: ActiveOrder,
    remainingQty: number
  ): void {
    this.clearPartialFillTimer(order.orderId);
    const timer = setTimeout(async () => {
      try {
        if (order.kisOrderNo && order.sm.canTransition('CANCEL_REQUESTED')) {
          order.sm.transition('CANCEL_REQUESTED');
          await this.restClient.cancelOrder({
            orgOrderNo: order.kisOrderNo,
            stockCode: order.stockCode,
            quantity: remainingQty
          });
        }
      } catch {
        // 취소 실패 → 다음 폴링에서 처리
      }
    }, 30_000);
    this.partialFillTimers.set(order.orderId, timer);
  }

  private clearPartialFillTimer(orderId: string): void {
    const timer = this.partialFillTimers.get(orderId);
    if (timer) {
      clearTimeout(timer);
      this.partialFillTimers.delete(orderId);
    }
  }

  private generateOrderId(): string {
    const now = new Date();
    const ts = now
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const rand = Math.random().toString(36).slice(2, 10);
    return `ORD-${ts}-${rand}`;
  }
}
