// Lab Strategy Research Module
export type {
  StrategyType,
  AlgorithmStatus,
  ParamFieldDef,
  RankedSignal,
  SignalMap,
  LabStrategy,
  LabTradeRecord,
  LabEquityPoint,
  LabBacktestResult,
  LabRiskParams,
  LabCostParams,
  LabBacktestConfig
} from './types.js';

export { STRATEGY_TYPE, ALGORITHM_STATUS } from './types.js';
export { simulatePortfolio } from './simulate.js';
export { registerStrategy, getStrategy, getAllStrategies } from './registry.js';
export { runLabBacktest } from './run-lab-backtest.js';

// Strategy implementations
export { dualMomentumStrategy } from './strategies/dual-momentum.js';
export { maCrossoverStrategy } from './strategies/ma-crossover.js';
export { bbRsiStrategy } from './strategies/bb-rsi.js';
export { turtleStrategy } from './strategies/turtle.js';
export { volatilityBreakoutStrategy } from './strategies/volatility-breakout.js';
export { buyAndHoldStrategy } from './strategies/buy-and-hold.js';
export { equalWeightStrategy } from './strategies/equal-weight.js';
export { runSweep } from './sweep.js';
export type { SweepConfig, SweepResult } from './sweep.js';
export {
  ensureLabSchema,
  ensureAlgorithm,
  saveLabResult
} from './lab-store.js';
