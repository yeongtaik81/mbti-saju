import type { LabStrategy, StrategyType } from './types.js';
import { dualMomentumStrategy } from './strategies/dual-momentum.js';
import { maCrossoverStrategy } from './strategies/ma-crossover.js';
import { bbRsiStrategy } from './strategies/bb-rsi.js';
import { turtleStrategy } from './strategies/turtle.js';
import { volatilityBreakoutStrategy } from './strategies/volatility-breakout.js';
import { buyAndHoldStrategy } from './strategies/buy-and-hold.js';
import { equalWeightStrategy } from './strategies/equal-weight.js';

const strategies = new Map<StrategyType, LabStrategy>();

export function registerStrategy(s: LabStrategy): void {
  strategies.set(s.type, s);
}

export function getStrategy(type: StrategyType): LabStrategy | undefined {
  return strategies.get(type);
}

export function getAllStrategies(): LabStrategy[] {
  return [...strategies.values()];
}

// 기본 전략 등록
registerStrategy(dualMomentumStrategy);
registerStrategy(maCrossoverStrategy);
registerStrategy(bbRsiStrategy);
registerStrategy(turtleStrategy);
registerStrategy(volatilityBreakoutStrategy);
registerStrategy(buyAndHoldStrategy);
registerStrategy(equalWeightStrategy);
