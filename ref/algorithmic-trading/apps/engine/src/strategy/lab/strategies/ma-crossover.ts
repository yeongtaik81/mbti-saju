/**
 * 이동평균 크로스오버 (MA Crossover)
 * 골든크로스(단기MA > 장기MA)에 매수, 데드크로스에 매도
 */
import type { Candle } from '@trading/shared/types';
import { sma } from '../../indicators.js';
import type {
  LabStrategy,
  SignalMap,
  RankedSignal,
  ParamFieldDef
} from '../types.js';
import { STRATEGY_TYPE } from '../types.js';

export const maCrossoverStrategy: LabStrategy = {
  type: STRATEGY_TYPE.MA_CROSSOVER,
  name: 'MA 크로스오버',
  description: '단기/장기 이동평균선 교차. 골든크로스 매수, 데드크로스 매도.',

  paramSchema: [
    {
      key: 'shortPeriod',
      label: '단기 MA',
      type: 'number',
      min: 3,
      max: 30,
      step: 1,
      default: 5
    },
    {
      key: 'longPeriod',
      label: '장기 MA',
      type: 'number',
      min: 15,
      max: 200,
      step: 5,
      default: 20
    }
  ] satisfies ParamFieldDef[],

  minLookback(params) {
    return (params['longPeriod'] ?? 20) + 5;
  },

  generateSignals(stockCandles, allDates, params): SignalMap {
    const shortPeriod = params['shortPeriod'] ?? 5;
    const longPeriod = params['longPeriod'] ?? 20;

    const buy = new Map<string, RankedSignal[]>();
    const sell = new Map<string, Set<string>>();

    for (const [code, candles] of stockCandles) {
      if (candles.length < longPeriod + 2) continue;

      const shortMa = sma(candles, shortPeriod);
      const longMa = sma(candles, longPeriod);

      for (let i = 1; i < candles.length; i++) {
        const sm = shortMa[i];
        const lm = longMa[i];
        const prevSm = shortMa[i - 1];
        const prevLm = longMa[i - 1];
        if (sm == null || lm == null || prevSm == null || prevLm == null)
          continue;

        const date = candles[i]!.date;

        // 골든크로스
        if (prevSm <= prevLm && sm > lm) {
          const score = (sm - lm) / lm; // 이격도를 스코어로
          if (!buy.has(date)) buy.set(date, []);
          buy.get(date)!.push({ stockCode: code, score });
        }

        // 데드크로스
        if (prevSm >= prevLm && sm < lm) {
          if (!sell.has(date)) sell.set(date, new Set());
          sell.get(date)!.add(code);
        }
      }
    }

    // 매수 시그널 정렬 (스코어 내림차순)
    for (const [, signals] of buy) {
      signals.sort((a, b) => b.score - a.score);
    }

    return { buy, sell };
  }
};
