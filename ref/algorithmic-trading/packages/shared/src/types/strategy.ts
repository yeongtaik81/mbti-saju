import type { OrderSide } from './order.js';

/** 시장 레짐 */
export const MarketRegime = {
  BULL: 'BULL',
  BEAR: 'BEAR',
  NEUTRAL: 'NEUTRAL'
} as const;
export type MarketRegime = (typeof MarketRegime)[keyof typeof MarketRegime];

/** 전략 파라미터 */
export interface StrategyParams {
  k: number; // 변동성 계수 (0.3~0.7)
  shortMaPeriod: number; // 단기 MA (3~10)
  longMaPeriod: number; // 장기 MA (15~60)
  rsiPeriod: number; // RSI 기간 (7~21)
  rsiLow: number; // RSI 하한 (20~40)
  rsiHigh: number; // RSI 상한 (60~80)
  stopLossRate: number; // 손절률 (-0.01~-0.05)
  takeProfitRate: number; // 익절률 (0.02~0.10)
  closingTime: string; // 장 마감 청산 시각 (HH:MM)
  // 스윙 전략 전용 (옵셔널 — 미설정 시 intraday 모드)
  strategyMode?: 'intraday' | 'swing';
  holdDays?: number; // 보유 거래일 (기본 7)
  breadthBullThreshold?: number; // breadth 상승장 기준 (기본 0.50)
  breadthBearThreshold?: number; // breadth 하락장 기준 (기본 0.40)
  maSupportProximity?: number; // MA 지지 근접도 (기본 0.02 = 2%)
  volumeRatioThreshold?: number; // 거래량 비율 기준 (기본 2.0)
}

/** 리스크 파라미터 */
export interface RiskParams {
  maxPositions: number; // 최대 보유 종목 수
  maxPositionWeight: number; // 종목당 최대 비중 (0~1)
  dailyLossLimit: number; // 일일 최대 손실률 (음수)
  totalCapital: number; // 총 투자금
}

/** 스크리닝 파라미터 */
export interface ScreeningParams {
  minMarketCap: number; // 최소 시가총액
  minVolumeAmount: number; // 최소 거래대금
  minPrice: number; // 최소 주가
  maxPrice: number; // 최대 주가
  maxCandidates: number; // 최대 후보 수
  markets: ('KOSPI' | 'KOSDAQ')[]; // 대상 시장
}

/** 전략 설정 */
export interface StrategyConfig {
  id: number;
  name: string;
  enabled: boolean;
  params: StrategyParams;
  riskParams: RiskParams;
  screeningParams: ScreeningParams;
  version: number;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
}

/** 매매 신호 */
export interface Signal {
  stockCode: string;
  stockName: string;
  side: OrderSide;
  reason: string; // 예: 'volatility_breakout+ma_cross+rsi'
  confidence: number; // 신호 강도 (0~1, 충족 조건 수 비율)
  price: number;
  quantity: number;
  paramsSnapshot: StrategyParams;
  timestamp: string;
}
