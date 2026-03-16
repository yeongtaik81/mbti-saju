import type Database from 'better-sqlite3';
import type { EventBus, EngineEvent } from '../event/event-bus.js';
import { EngineEventType } from '../event/event-bus.js';

/** 포지션 정보 */
export interface TrackedPosition {
  stockCode: string;
  stockName: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlRate: number;
  boughtAt: string;
}

/**
 * PositionTracker: 포지션 추적 및 관리
 * [MF-1] positions, trades 테이블의 유일한 writer
 * [MF-4] ORDER_FILLED + ORDER_PARTIAL_FILLED 구독
 */
export class PositionTracker {
  private readonly db: Database.Database;
  private readonly eventBus: EventBus;
  private readonly fillHandler: (event: EngineEvent) => void;
  private readonly partialFillHandler: (event: EngineEvent) => void;
  private started = false;

  // [M5] 캐시된 prepared statements (inline 제거)
  private readonly upsertPosition: Database.Statement;
  private readonly updatePositionPrice: Database.Statement;
  private readonly setPositionQtyPrice: Database.Statement;
  private readonly updatePositionFull: Database.Statement;
  private readonly deletePosition: Database.Statement;
  private readonly reducePosition: Database.Statement;
  private readonly insertTrade: Database.Statement;
  private readonly insertSnapshot: Database.Statement;
  private readonly getPositionStmt: Database.Statement;
  private readonly getBuyOrderStmt: Database.Statement;
  private readonly getOrderStrategyStmt: Database.Statement;

  constructor(deps: { db: Database.Database; eventBus: EventBus }) {
    this.db = deps.db;
    this.eventBus = deps.eventBus;

    this.upsertPosition = this.db.prepare(`
      INSERT INTO positions (stock_code, stock_name, quantity, avg_price, current_price, pnl, pnl_rate, bought_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, datetime('now','localtime'))
      ON CONFLICT(stock_code) DO UPDATE SET
        quantity = quantity + excluded.quantity,
        avg_price = (avg_price * positions.quantity + excluded.avg_price * excluded.quantity) / (positions.quantity + excluded.quantity),
        updated_at = datetime('now','localtime')
    `);

    this.updatePositionPrice = this.db.prepare(`
      UPDATE positions SET
        current_price = ?,
        pnl = (? - avg_price) * quantity,
        pnl_rate = CASE WHEN avg_price > 0 THEN (? - avg_price) / avg_price ELSE 0 END,
        updated_at = datetime('now','localtime')
      WHERE stock_code = ?
    `);

    // [M5] 부분체결 시 수량/가격 직접 갱신
    this.setPositionQtyPrice = this.db.prepare(`
      UPDATE positions SET
        quantity = ?, avg_price = ?, current_price = ?,
        updated_at = datetime('now','localtime')
      WHERE stock_code = ?
    `);

    // [M5] openPosition에서 기존 포지션 업데이트
    this.updatePositionFull = this.db.prepare(`
      UPDATE positions SET quantity = ?, avg_price = ?, current_price = ?,
        pnl = (? - ?) * ?, pnl_rate = CASE WHEN ? > 0 THEN (? - ?) / ? ELSE 0 END,
        updated_at = datetime('now','localtime')
      WHERE stock_code = ?
    `);

    this.deletePosition = this.db.prepare(
      `DELETE FROM positions WHERE stock_code = ?`
    );

    // [M5] 부분 청산 시 수량 감소
    this.reducePosition = this.db.prepare(`
      UPDATE positions SET quantity = ?,
        pnl = (current_price - avg_price) * ?,
        updated_at = datetime('now','localtime')
      WHERE stock_code = ?
    `);

    this.insertTrade = this.db.prepare(`
      INSERT INTO trades (stock_code, stock_name, buy_order_id, sell_order_id, quantity,
        buy_price, sell_price, pnl, pnl_rate, fee_total, strategy, signal, bought_at, sold_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertSnapshot = this.db.prepare(`
      INSERT OR REPLACE INTO portfolio_snapshots (date, total_value, cash, stock_value,
        daily_pnl, daily_pnl_rate, cumulative_pnl_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // [M5] 캐시된 조회 statements
    this.getPositionStmt = this.db.prepare(`
      SELECT stock_code, stock_name, quantity, avg_price, current_price, pnl, pnl_rate, bought_at
      FROM positions WHERE stock_code = ?
    `);

    this.getBuyOrderStmt = this.db.prepare(`
      SELECT order_id FROM orders
      WHERE stock_code = ? AND side = 'buy' AND status = 'FILLED'
      ORDER BY created_at DESC LIMIT 1
    `);

    this.getOrderStrategyStmt = this.db.prepare(`
      SELECT strategy FROM orders WHERE order_id = ?
    `);

    this.fillHandler = (event: EngineEvent) => this.handleFill(event);
    this.partialFillHandler = (event: EngineEvent) =>
      this.handlePartialFill(event);
  }

  start(): void {
    if (this.started) return;
    this.eventBus.subscribe(EngineEventType.ORDER_FILLED, this.fillHandler);
    this.eventBus.subscribe(
      EngineEventType.ORDER_PARTIAL_FILLED,
      this.partialFillHandler
    );
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.eventBus.unsubscribe(EngineEventType.ORDER_FILLED, this.fillHandler);
    this.eventBus.unsubscribe(
      EngineEventType.ORDER_PARTIAL_FILLED,
      this.partialFillHandler
    );
    this.started = false;
  }

  /**
   * 전량 체결 처리
   * [M1] 부분체결 후 전량체결 시 이중 계산 방지:
   * filledQuantity는 누적 체결수량이므로, 기존 포지션을 대체(replace)한다.
   */
  private handleFill(event: EngineEvent): void {
    const { orderId, stockCode, side, filledQuantity, filledPrice } =
      event.data as {
        orderId: string;
        stockCode: string;
        side: string;
        filledQuantity: number;
        filledPrice: number;
      };

    if (side === 'buy') {
      this.openOrReplacePosition(
        stockCode,
        orderId,
        filledQuantity,
        filledPrice
      );
    } else {
      this.closePosition(stockCode, orderId, filledQuantity, filledPrice);
    }
  }

  /**
   * 부분 체결 처리 [MF-4]
   * filledQuantity는 누적 체결수량 (증분이 아님)
   * [M5] 매도 부분체결도 처리
   */
  private handlePartialFill(event: EngineEvent): void {
    const { stockCode, side, filledQuantity, filledPrice } = event.data as {
      stockCode: string;
      side: string;
      filledQuantity: number;
      filledPrice: number;
    };

    if (side === 'buy') {
      // 누적 수량으로 포지션을 덮어쓴다 (증분 X)
      const existing = this.getPosition(stockCode);
      if (!existing) {
        this.upsertPosition.run(
          stockCode,
          stockCode,
          filledQuantity,
          filledPrice,
          filledPrice
        );
      } else {
        this.setPositionQtyPrice.run(
          filledQuantity,
          filledPrice,
          filledPrice,
          stockCode
        );
      }
    } else {
      // [M5] 매도 부분체결: 포지션 수량 감소 (청산 기록은 전량 체결 시 작성)
      const existing = this.getPosition(stockCode);
      if (existing && filledQuantity < existing.quantity) {
        const newQty = existing.quantity - filledQuantity;
        this.reducePosition.run(newQty, newQty, stockCode);
      }
    }
  }

  /**
   * 매수 체결 → 포지션 오픈 또는 대체
   * [M1] 부분체결로 이미 생성된 포지션이 있으면 누적 수량으로 대체
   */
  private openOrReplacePosition(
    stockCode: string,
    orderId: string,
    quantity: number,
    price: number
  ): void {
    const existing = this.getPosition(stockCode);

    if (existing) {
      // [M1] 부분체결→전량체결: 누적 수량이므로 기존을 대체
      this.setPositionQtyPrice.run(quantity, price, price, stockCode);
    } else {
      this.upsertPosition.run(stockCode, stockCode, quantity, price, price);
    }

    this.eventBus.publish({
      type: EngineEventType.POSITION_OPENED,
      timestamp: new Date().toISOString(),
      data: { stockCode, quantity, price, orderId }
    });
  }

  /** 매도 체결 → 포지션 축소/청산 + 거래 기록 */
  private closePosition(
    stockCode: string,
    orderId: string,
    quantity: number,
    sellPrice: number
  ): void {
    const existing = this.getPosition(stockCode);
    if (!existing) return;

    const buyPrice = existing.avgPrice;
    const pnl = (sellPrice - buyPrice) * quantity;
    const pnlRate = buyPrice > 0 ? (sellPrice - buyPrice) / buyPrice : 0;

    // [M5] 캐시된 statement 사용
    const buyOrderRow = this.getBuyOrderStmt.get(stockCode) as
      | { order_id: string }
      | undefined;

    // 매도 주문의 strategy를 조회, 없으면 매수 주문에서 조회
    const sellStrategy = this.getOrderStrategyStmt.get(orderId) as
      | { strategy: string }
      | undefined;
    const buyStrategy = buyOrderRow
      ? (this.getOrderStrategyStmt.get(buyOrderRow.order_id) as
          | { strategy: string }
          | undefined)
      : undefined;
    const strategy =
      sellStrategy?.strategy ?? buyStrategy?.strategy ?? 'unknown';

    this.insertTrade.run(
      stockCode,
      existing.stockName,
      buyOrderRow?.order_id ?? 'unknown',
      orderId,
      quantity,
      buyPrice,
      sellPrice,
      pnl,
      pnlRate,
      0,
      strategy,
      'auto',
      existing.boughtAt ?? new Date().toISOString(),
      new Date().toISOString()
    );

    if (quantity >= existing.quantity) {
      // 전량 청산
      this.deletePosition.run(stockCode);
    } else {
      // 부분 청산
      const newQty = existing.quantity - quantity;
      this.reducePosition.run(newQty, newQty, stockCode);
    }

    this.eventBus.publish({
      type: EngineEventType.POSITION_CLOSED,
      timestamp: new Date().toISOString(),
      data: { stockCode, quantity, sellPrice, pnl, pnlRate, orderId }
    });
  }

  /** 실시간 가격 업데이트 */
  updatePrices(prices: Map<string, number>): void {
    for (const [stockCode, price] of prices) {
      this.updatePositionPrice.run(price, price, price, stockCode);
    }
  }

  /** 일말 포트폴리오 스냅샷 저장 */
  saveSnapshot(date: string, cash: number, initialCapital: number): void {
    const positions = this.getOpenPositions();
    const stockValue = positions.reduce(
      (sum, p) => sum + p.currentPrice * p.quantity,
      0
    );
    const totalValue = cash + stockValue;
    const dailyPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const dailyPnlRate = totalValue > 0 ? dailyPnl / totalValue : 0;
    const cumulativePnlRate =
      initialCapital > 0 ? (totalValue - initialCapital) / initialCapital : 0;

    this.insertSnapshot.run(
      date,
      totalValue,
      cash,
      stockValue,
      dailyPnl,
      dailyPnlRate,
      cumulativePnlRate
    );
  }

  /** 현재 보유 포지션 목록 */
  getOpenPositions(): TrackedPosition[] {
    const rows = this.db
      .prepare(
        `
      SELECT stock_code, stock_name, quantity, avg_price, current_price, pnl, pnl_rate, bought_at
      FROM positions
    `
      )
      .all() as Array<{
      stock_code: string;
      stock_name: string;
      quantity: number;
      avg_price: number;
      current_price: number;
      pnl: number;
      pnl_rate: number;
      bought_at: string;
    }>;

    return rows.map((r) => ({
      stockCode: r.stock_code,
      stockName: r.stock_name,
      quantity: r.quantity,
      avgPrice: r.avg_price,
      currentPrice: r.current_price,
      pnl: r.pnl,
      pnlRate: r.pnl_rate,
      boughtAt: r.bought_at
    }));
  }

  /** 당일 실현 손익 */
  getDailyRealizedPnl(date: string): number {
    const row = this.db
      .prepare(
        `
      SELECT COALESCE(SUM(pnl), 0) as total_pnl FROM trades
      WHERE DATE(sold_at) = ?
    `
      )
      .get(date) as { total_pnl: number };
    return row.total_pnl;
  }

  /** 인트라데이 전략: 장 마감 시 0건 확인 */
  verifyAllClosed(): boolean {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM positions')
      .get() as { cnt: number };
    return row.cnt === 0;
  }

  private getPosition(
    stockCode: string
  ): (TrackedPosition & { boughtAt?: string }) | undefined {
    // [M5] 캐시된 statement 사용
    const row = this.getPositionStmt.get(stockCode) as
      | {
          stock_code: string;
          stock_name: string;
          quantity: number;
          avg_price: number;
          current_price: number;
          pnl: number;
          pnl_rate: number;
          bought_at: string;
        }
      | undefined;

    if (!row) return undefined;
    return {
      stockCode: row.stock_code,
      stockName: row.stock_name,
      quantity: row.quantity,
      avgPrice: row.avg_price,
      currentPrice: row.current_price,
      pnl: row.pnl,
      pnlRate: row.pnl_rate,
      boughtAt: row.bought_at
    };
  }
}
