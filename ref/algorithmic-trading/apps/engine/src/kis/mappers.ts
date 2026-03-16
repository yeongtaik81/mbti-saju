import type { Candle, MinuteCandle, OrderSide } from '@trading/shared/types';
import type {
  KisDailyCandleItem,
  KisMinuteCandleItem,
  KisBalanceItem,
  KisExecutionItem
} from './types.js';

/** 문자열 → 숫자 변환 (NaN 시 에러) */
function toNum(value: string, field: string): number {
  const n = Number(value);
  if (Number.isNaN(n))
    throw new Error(`Invalid number for ${field}: "${value}"`);
  return n;
}

/** 보유 포지션 (KIS 잔고 → 로컬 타입) */
export interface Position {
  stockCode: string;
  stockName: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  evalAmount: number;
  evalPnl: number;
  evalPnlRate: number;
}

/**
 * KIS 일봉 → 도메인 Candle
 * YYYYMMDD → YYYY-MM-DD, 문자열 → 숫자
 */
export function toCandle(item: KisDailyCandleItem, stockCode: string): Candle {
  const d = item.stck_bsop_date;
  const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

  return {
    stockCode,
    date,
    open: toNum(item.stck_oprc, 'open'),
    high: toNum(item.stck_hgpr, 'high'),
    low: toNum(item.stck_lwpr, 'low'),
    close: toNum(item.stck_clpr, 'close'),
    volume: toNum(item.acml_vol, 'volume'),
    amount: toNum(item.acml_tr_pbmn, 'amount')
  };
}

/**
 * KIS 분봉 → 도메인 MinuteCandle
 * YYYYMMDD + HHMMSS → YYYY-MM-DD HH:MM
 */
export function toMinuteCandle(
  item: KisMinuteCandleItem,
  stockCode: string
): MinuteCandle {
  const d = item.stck_bsop_date;
  const t = item.stck_cntg_hour;
  const datetime = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${t.slice(0, 2)}:${t.slice(2, 4)}`;

  return {
    stockCode,
    datetime,
    open: toNum(item.stck_oprc, 'open'),
    high: toNum(item.stck_hgpr, 'high'),
    low: toNum(item.stck_lwpr, 'low'),
    close: toNum(item.stck_prpr, 'close'),
    volume: toNum(item.cntg_vol, 'volume')
  };
}

/** KIS 잔고 아이템 → Position */
export function toPosition(item: KisBalanceItem): Position {
  return {
    stockCode: item.pdno,
    stockName: item.prdt_name,
    quantity: toNum(item.hldg_qty, 'quantity'),
    avgPrice: toNum(item.pchs_avg_pric, 'avgPrice'),
    currentPrice: toNum(item.prpr, 'currentPrice'),
    evalAmount: toNum(item.evlu_amt, 'evalAmount'),
    evalPnl: toNum(item.evlu_pfls_amt, 'evalPnl'),
    evalPnlRate: toNum(item.evlu_pfls_rt, 'evalPnlRate')
  };
}

/** KIS 체결 내역 → 도메인 변환 결과 [C-2] */
export interface KisExecutionMapped {
  kisOrderNo: string;
  orgOrderNo: string;
  stockCode: string;
  side: OrderSide;
  orderQuantity: number;
  filledQuantity: number;
  filledAmount: number;
  avgPrice: number;
  orderPrice: number;
  orderTime: string;
}

/** KIS 체결 아이템 → 도메인 타입 */
export function toExecution(item: KisExecutionItem): KisExecutionMapped {
  const side: OrderSide = item.sll_buy_dvsn_cd === '02' ? 'buy' : 'sell';
  return {
    kisOrderNo: item.odno,
    orgOrderNo: item.orgn_odno,
    stockCode: item.pdno,
    side,
    orderQuantity: toNum(item.ord_qty, 'orderQuantity'),
    filledQuantity: toNum(item.tot_ccld_qty, 'filledQuantity'),
    filledAmount: toNum(item.tot_ccld_amt, 'filledAmount'),
    avgPrice: toNum(item.pchs_avg_pric, 'avgPrice'),
    orderPrice: toNum(item.ord_unpr, 'orderPrice'),
    orderTime: item.ord_tmd
  };
}
