/**
 * Equal Weight 벤치마크 전략
 * 주기적으로 전 종목 균등 비중 리밸런싱.
 */
import type { Candle } from '@trading/shared/types';
import type {
  LabStrategy,
  SignalMap,
  RankedSignal,
  ParamFieldDef
} from '../types.js';
import { STRATEGY_TYPE } from '../types.js';

export const equalWeightStrategy: LabStrategy = {
  type: STRATEGY_TYPE.EQUAL_WEIGHT,
  name: 'Equal Weight',
  description: '주기적 균등 비중 리밸런싱. 벤치마크용.',

  paramSchema: [
    {
      key: 'rebalanceDays',
      label: '리밸런싱 주기(거래일)',
      type: 'number',
      min: 1,
      max: 252,
      step: 1,
      default: 20
    }
  ] satisfies ParamFieldDef[],

  minLookback() {
    return 0;
  },

  generateSignals(stockCandles, allDates, params): SignalMap {
    const buy = new Map<string, RankedSignal[]>();
    const sell = new Map<string, Set<string>>();
    const rebalanceDays = params['rebalanceDays'] ?? 20;

    const codes = [...stockCandles.keys()];
    if (codes.length === 0 || allDates.length === 0) return { buy, sell };

    for (let i = 0; i < allDates.length; i++) {
      if (i % rebalanceDays !== 0) continue;
      const date = allDates[i]!;

      // 리밸런싱: 기존 전부 매도 + 전부 매수
      if (i > 0) {
        sell.set(date, new Set(codes));
      }
      buy.set(
        date,
        codes.map((code) => ({ stockCode: code, score: 1 }))
      );
    }

    return { buy, sell };
  }
};
