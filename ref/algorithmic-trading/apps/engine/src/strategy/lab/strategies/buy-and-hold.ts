/**
 * Buy and Hold 벤치마크 전략
 * 첫 날에 모든 종목을 균등 매수, 끝까지 보유.
 */
import type { Candle } from '@trading/shared/types';
import type {
  LabStrategy,
  SignalMap,
  RankedSignal,
  ParamFieldDef
} from '../types.js';
import { STRATEGY_TYPE } from '../types.js';

export const buyAndHoldStrategy: LabStrategy = {
  type: STRATEGY_TYPE.BUY_AND_HOLD,
  name: 'Buy & Hold',
  description: '첫 거래일에 균등 매수 후 끝까지 보유. 벤치마크용.',

  paramSchema: [] satisfies ParamFieldDef[],

  minLookback() {
    return 0;
  },

  generateSignals(stockCandles, allDates): SignalMap {
    const buy = new Map<string, RankedSignal[]>();
    const sell = new Map<string, Set<string>>();

    if (allDates.length === 0) return { buy, sell };

    // 첫 날에 모든 종목 매수 시그널 (동일 score)
    const firstDate = allDates[0]!;
    const signals: RankedSignal[] = [];
    for (const [code] of stockCandles) {
      signals.push({ stockCode: code, score: 1 });
    }
    if (signals.length > 0) {
      buy.set(firstDate, signals);
    }

    return { buy, sell };
  }
};
