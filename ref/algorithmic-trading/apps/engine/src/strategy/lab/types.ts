import type { Candle } from '@trading/shared/types';

// ── Strategy Type ──

export const STRATEGY_TYPE = {
  DUAL_MOMENTUM: 'dual_momentum',
  MA_CROSSOVER: 'ma_crossover',
  BB_RSI: 'bb_rsi',
  TURTLE: 'turtle',
  VOLATILITY_BREAKOUT: 'volatility_breakout',
  BUY_AND_HOLD: 'buy_and_hold',
  EQUAL_WEIGHT: 'equal_weight'
} as const;
export type StrategyType = (typeof STRATEGY_TYPE)[keyof typeof STRATEGY_TYPE];

// ── Algorithm Status ──

export const ALGORITHM_STATUS = {
  RESEARCHING: 'researching',
  PROMISING: 'promising',
  ADOPTED: 'adopted',
  ABANDONED: 'abandoned'
} as const;
export type AlgorithmStatus =
  (typeof ALGORITHM_STATUS)[keyof typeof ALGORITHM_STATUS];

// ── Param Schema (동적 폼 렌더링용) ──

export interface ParamFieldDef {
  key: string;
  label: string;
  type: 'number' | 'select';
  min?: number;
  max?: number;
  step?: number;
  default: number;
  description?: string;
}

// ── Signal Map ──
// 타이밍 계약: 전략은 "관찰일"(해당 날짜의 종가/지표를 본 날)에 시그널을 기록한다.
// 시뮬레이터는 자동으로 다음 거래일 시가에 체결한다 (lookahead 방지).
// 즉 전략은 절대 수동으로 nextDate를 밀 필요 없다.

export interface RankedSignal {
  stockCode: string;
  score: number; // 높을수록 우선
}

export interface SignalMap {
  buy: Map<string, RankedSignal[]>; // observationDate → scored candidates (내림차순)
  sell: Map<string, Set<string>>; // observationDate → stockCodes to sell
}

// ── Lab Strategy Interface ──

export interface LabStrategy {
  readonly type: StrategyType;
  readonly name: string;
  readonly description: string;
  readonly paramSchema: ParamFieldDef[];
  /** 전략이 시그널을 생성하기 위해 필요한 최소 과거 데이터 일수.
   *  params에 따라 동적으로 계산해야 하므로 함수로 선언. */
  minLookback(params: Record<string, number>): number;
  generateSignals(
    stockCandles: Map<string, Candle[]>,
    allDates: string[],
    params: Record<string, number>
  ): SignalMap;
}

// ── Trade / Equity 레코드 (UI 호환) ──

export interface LabTradeRecord {
  stockCode: string;
  buyDate: string;
  sellDate: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  pnl: number;
  pnlRate: number;
  fee: number;
  tax: number;
  holdDays: number;
  reason: string;
}

export interface LabEquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

// ── Lab Backtest Result ──

export interface LabBacktestResult {
  runId: string;
  algorithmId: string;
  strategyType: StrategyType;
  name: string;
  params: Record<string, number>;
  riskParams: LabRiskParams;
  costParams: LabCostParams;
  stockCodes: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  executionModel: 'daily';
  // 메트릭
  totalReturn: number;
  cagr: number;
  mdd: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  totalTrades: number;
  avgHoldDays: number;
  // 상세
  trades: LabTradeRecord[];
  equityCurve: LabEquityPoint[];
  createdAt: string;
}

// ── Risk / Cost Params ──

export interface LabRiskParams {
  stopLossRate: number;
  takeProfitRate: number;
  maxHoldDays: number;
  maxPositions: number;
  maxWeight: number;
}

export interface LabCostParams {
  slippageRate: number;
  feeRate: number;
  taxRate: number;
}

// ── Lab Backtest Config ──

export interface LabBacktestConfig {
  algorithmId: string;
  strategyType: StrategyType;
  name: string;
  params: Record<string, number>;
  riskParams: LabRiskParams;
  costParams?: Partial<LabCostParams>;
  stockCodes: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  /** 체결 지연 일수. 기본 1 (T+1). 강건성 테스트에서 2 이상으로 설정. */
  executionDelay?: number;
  /** 체결 가격 모델. 기본 'open' (시가). 'vwap'은 (H+L+C)/3 근사. */
  executionPrice?: 'open' | 'vwap';
}
