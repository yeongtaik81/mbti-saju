import type { OrderSide } from './order.js';

/** 체결 정보 */
export interface Execution {
  id: number;
  orderId: string;
  stockCode: string;
  side: OrderSide;
  quantity: number;
  price: number;
  amount: number;
  fee: number;
  tax: number;
  executedAt: string;
}
