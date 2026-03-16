/** 장 상태 */
export const SessionState = {
  IDLE: 'IDLE',
  PRE_MARKET: 'PRE_MARKET',
  OPENING_AUCTION: 'OPENING_AUCTION',
  TRADING: 'TRADING',
  PAUSED: 'PAUSED',
  CLOSING: 'CLOSING',
  CLOSING_AUCTION: 'CLOSING_AUCTION',
  POST_MARKET: 'POST_MARKET'
} as const;
export type SessionState = (typeof SessionState)[keyof typeof SessionState];

/** 시장 구분 */
export const Market = {
  KOSPI: 'KOSPI',
  KOSDAQ: 'KOSDAQ'
} as const;
export type Market = (typeof Market)[keyof typeof Market];

/** 캔들 (OHLCV) */
export interface Candle {
  stockCode: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number;
  volume: number;
  amount?: number;
}

/** 분봉 캔들 */
export interface MinuteCandle {
  stockCode: string;
  datetime: string; // YYYY-MM-DD HH:MM
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** 종목 정보 */
export interface StockInfo {
  stockCode: string;
  stockName: string;
  market: Market;
  marketCap: number;
  price: number;
  volume: number;
  volumeAmount: number;
}

/** 휴장일 유형 */
export const MarketDayType = {
  HOLIDAY: 'HOLIDAY',
  HALF_DAY: 'HALF_DAY',
  DELAYED_OPEN: 'DELAYED_OPEN'
} as const;
export type MarketDayType = (typeof MarketDayType)[keyof typeof MarketDayType];

/** 휴장일 캘린더 */
export interface MarketCalendarEntry {
  date: string;
  type: MarketDayType;
  openTime: string;
  closeTime: string;
  description: string;
}
