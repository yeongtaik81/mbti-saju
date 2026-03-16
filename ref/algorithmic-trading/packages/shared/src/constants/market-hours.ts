/** 기본 장 시간 (정규장) */
export const DEFAULT_MARKET_HOURS = {
  preMarketStart: '08:00',
  openingAuctionStart: '08:30',
  openingAuctionEnd: '09:00',
  tradingStart: '09:00',
  closingStart: '15:15', // 청산 시작
  newOrderCutoff: '15:20', // 신규 매수 차단
  closingAuctionStart: '15:20',
  closingAuctionEnd: '15:30',
  marketClose: '15:30',
  postMarketEnd: '15:40'
} as const;

/** 상한/하한가 비율 */
export const PRICE_LIMIT_RATE = 0.3; // ±30%
