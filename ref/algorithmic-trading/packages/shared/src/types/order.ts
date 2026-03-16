/** 주문 상태 */
export const OrderStatus = {
  CREATED: 'CREATED',
  SUBMITTED: 'SUBMITTED',
  PENDING: 'PENDING',
  PARTIAL_FILLED: 'PARTIAL_FILLED',
  FILLED: 'FILLED',
  REJECTED: 'REJECTED',
  CANCEL_REQUESTED: 'CANCEL_REQUESTED',
  CANCELLED: 'CANCELLED'
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** 주문 유형 */
export const OrderType = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT'
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

/** 주문 방향 */
export const OrderSide = {
  BUY: 'buy',
  SELL: 'sell'
} as const;
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

/** 주문 요청 */
export interface OrderRequest {
  orderId: string;
  stockCode: string;
  stockName: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price: number; // 시장가일 때 0
  strategy: string;
  signal: string;
}

/** 주문 응답 (KIS) */
export interface OrderResponse {
  kisOrderNo: string;
  status: OrderStatus;
  message?: string;
}

/** 주문 전체 정보 */
export interface Order {
  id: number;
  orderId: string;
  kisOrderNo: string | null;
  stockCode: string;
  stockName: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price: number;
  status: OrderStatus;
  filledQuantity: number;
  filledPrice: number;
  rejectReason: string | null;
  strategy: string;
  signal: string;
  createdAt: string;
  updatedAt: string;
}
