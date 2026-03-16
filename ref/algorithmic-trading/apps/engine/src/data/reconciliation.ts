import type Database from 'better-sqlite3';
import type { KisRestClient } from '../kis/rest-client.js';
import { toPosition } from '../kis/mappers.js';
import type { Position } from '../kis/mappers.js';

/** 불일치 유형 */
export const MismatchType = {
  MISSING_LOCAL: 'missing_local',
  MISSING_KIS: 'missing_kis',
  QUANTITY_MISMATCH: 'quantity_mismatch'
} as const;
export type MismatchType = (typeof MismatchType)[keyof typeof MismatchType];

/** 불일치 항목 */
export interface Mismatch {
  type: MismatchType;
  stockCode: string;
  stockName: string;
  kisQuantity?: number;
  localQuantity?: number;
  kisAvgPrice?: number;
  localAvgPrice?: number;
}

/** 로컬 포지션 */
interface LocalPosition {
  stock_code: string;
  stock_name: string;
  quantity: number;
  avg_price: number;
}

/**
 * KIS 잔고 ↔ 로컬 positions 테이블 비교
 */
export class BalanceReconciler {
  private readonly db: Database.Database;
  private readonly client: KisRestClient;

  constructor(db: Database.Database, client: KisRestClient) {
    this.db = db;
    this.client = client;
  }

  /** 비교만 수행 (DB 미수정) */
  async reconcile(): Promise<Mismatch[]> {
    const { items } = await this.client.getBalance();
    const kisPositions = items.map(toPosition);
    const localPositions = this.getLocalPositions();
    return this.compare(kisPositions, localPositions);
  }

  /**
   * KIS 잔고로 로컬 동기화
   * - missing_local → INSERT
   * - quantity_mismatch → UPDATE
   * - missing_kis → 경고만 (자동 삭제 안 함)
   */
  async syncFromKis(): Promise<{
    mismatches: Mismatch[];
    synced: string[];
    warnings: string[];
  }> {
    const { items } = await this.client.getBalance();
    const kisPositions = items.map(toPosition);
    const localPositions = this.getLocalPositions();
    const mismatches = this.compare(kisPositions, localPositions);

    const synced: string[] = [];
    const warnings: string[] = [];

    const insertStmt = this.db.prepare(`
      INSERT INTO positions (stock_code, stock_name, quantity, avg_price, current_price, pnl, pnl_rate, bought_at)
      VALUES (@stockCode, @stockName, @quantity, @avgPrice, @currentPrice, @pnl, @pnlRate, datetime('now', 'localtime'))
    `);

    const updateStmt = this.db.prepare(`
      UPDATE positions SET quantity = @quantity, avg_price = @avgPrice, current_price = @currentPrice,
        pnl = @pnl, pnl_rate = @pnlRate, updated_at = datetime('now', 'localtime')
      WHERE stock_code = @stockCode
    `);

    const syncTx = this.db.transaction(() => {
      for (const m of mismatches) {
        if (m.type === MismatchType.MISSING_LOCAL) {
          const kisPos = kisPositions.find((p) => p.stockCode === m.stockCode)!;
          insertStmt.run({
            stockCode: kisPos.stockCode,
            stockName: kisPos.stockName,
            quantity: kisPos.quantity,
            avgPrice: kisPos.avgPrice,
            currentPrice: kisPos.currentPrice,
            pnl: kisPos.evalPnl,
            pnlRate: kisPos.evalPnlRate
          });
          synced.push(m.stockCode);
        } else if (m.type === MismatchType.QUANTITY_MISMATCH) {
          const kisPos = kisPositions.find((p) => p.stockCode === m.stockCode)!;
          updateStmt.run({
            stockCode: kisPos.stockCode,
            quantity: kisPos.quantity,
            avgPrice: kisPos.avgPrice,
            currentPrice: kisPos.currentPrice,
            pnl: kisPos.evalPnl,
            pnlRate: kisPos.evalPnlRate
          });
          synced.push(m.stockCode);
        } else if (m.type === MismatchType.MISSING_KIS) {
          warnings.push(
            `${m.stockCode} (${m.stockName}) exists locally but not in KIS`
          );
        }
      }
    });

    syncTx();

    return { mismatches, synced, warnings };
  }

  /** 로컬 포지션 조회 */
  private getLocalPositions(): LocalPosition[] {
    return this.db
      .prepare(
        'SELECT stock_code, stock_name, quantity, avg_price FROM positions'
      )
      .all() as LocalPosition[];
  }

  /** KIS ↔ 로컬 비교 */
  private compare(
    kisPositions: Position[],
    localPositions: LocalPosition[]
  ): Mismatch[] {
    const mismatches: Mismatch[] = [];
    const localMap = new Map(localPositions.map((p) => [p.stock_code, p]));
    const kisMap = new Map(kisPositions.map((p) => [p.stockCode, p]));

    // KIS에는 있지만 로컬에 없는 경우
    for (const kisPos of kisPositions) {
      const local = localMap.get(kisPos.stockCode);
      if (!local) {
        mismatches.push({
          type: MismatchType.MISSING_LOCAL,
          stockCode: kisPos.stockCode,
          stockName: kisPos.stockName,
          kisQuantity: kisPos.quantity,
          kisAvgPrice: kisPos.avgPrice
        });
      } else if (local.quantity !== kisPos.quantity) {
        mismatches.push({
          type: MismatchType.QUANTITY_MISMATCH,
          stockCode: kisPos.stockCode,
          stockName: kisPos.stockName,
          kisQuantity: kisPos.quantity,
          localQuantity: local.quantity,
          kisAvgPrice: kisPos.avgPrice,
          localAvgPrice: local.avg_price
        });
      }
    }

    // 로컬에는 있지만 KIS에 없는 경우
    for (const localPos of localPositions) {
      if (!kisMap.has(localPos.stock_code)) {
        mismatches.push({
          type: MismatchType.MISSING_KIS,
          stockCode: localPos.stock_code,
          stockName: localPos.stock_name,
          localQuantity: localPos.quantity,
          localAvgPrice: localPos.avg_price
        });
      }
    }

    return mismatches;
  }
}
