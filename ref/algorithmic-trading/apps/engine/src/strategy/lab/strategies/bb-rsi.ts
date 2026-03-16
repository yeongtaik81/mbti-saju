/**
 * 볼린저 밴드 + RSI (BB+RSI)
 * 평균회귀 전략: 하단밴드 + RSI 과매도 → 매수, 상단밴드/RSI 과매수 → 매도
 */
import type { Candle } from '@trading/shared/types';
import { bollingerBands, rsi } from '../../indicators.js';
import type {
  LabStrategy,
  SignalMap,
  RankedSignal,
  ParamFieldDef
} from '../types.js';
import { STRATEGY_TYPE } from '../types.js';

export const bbRsiStrategy: LabStrategy = {
  type: STRATEGY_TYPE.BB_RSI,
  name: 'BB + RSI',
  description:
    '볼린저 밴드 하단 + RSI 과매도에 매수 (평균회귀). 상단/과매수에 매도.',

  paramSchema: [
    {
      key: 'bbPeriod',
      label: 'BB 기간',
      type: 'number',
      min: 10,
      max: 50,
      step: 5,
      default: 20
    },
    {
      key: 'bbK',
      label: 'BB K (표준편차)',
      type: 'number',
      min: 1,
      max: 3,
      step: 0.5,
      default: 2
    },
    {
      key: 'rsiPeriod',
      label: 'RSI 기간',
      type: 'number',
      min: 5,
      max: 21,
      step: 1,
      default: 14
    },
    {
      key: 'rsiLow',
      label: 'RSI 과매도',
      type: 'number',
      min: 10,
      max: 40,
      step: 5,
      default: 30
    },
    {
      key: 'rsiHigh',
      label: 'RSI 과매수',
      type: 'number',
      min: 60,
      max: 90,
      step: 5,
      default: 70
    }
  ] satisfies ParamFieldDef[],

  minLookback(params) {
    return Math.max(params['bbPeriod'] ?? 20, params['rsiPeriod'] ?? 14) + 5;
  },

  generateSignals(stockCandles, allDates, params): SignalMap {
    const bbPeriod = params['bbPeriod'] ?? 20;
    const bbK = params['bbK'] ?? 2;
    const rsiPeriod = params['rsiPeriod'] ?? 14;
    const rsiLow = params['rsiLow'] ?? 30;
    const rsiHigh = params['rsiHigh'] ?? 70;

    const buy = new Map<string, RankedSignal[]>();
    const sell = new Map<string, Set<string>>();

    for (const [code, candles] of stockCandles) {
      if (candles.length < Math.max(bbPeriod, rsiPeriod) + 2) continue;

      const bb = bollingerBands(candles, bbPeriod, bbK);
      const rsiVals = rsi(candles, rsiPeriod);

      for (let i = 1; i < candles.length; i++) {
        const close = candles[i]!.adjClose ?? candles[i]!.close;
        const bbLower = bb.lower[i];
        const bbUpper = bb.upper[i];
        const r = rsiVals[i];

        if (bbLower == null || bbUpper == null || r == null) continue;

        const date = candles[i]!.date;

        // 매수: 종가 ≤ 하단밴드 + RSI 과매도
        if (close <= bbLower && r <= rsiLow) {
          // 스코어: 밴드 이탈도 + RSI 과매도 정도 (더 극단적일수록 높은 점수)
          const bandScore = bbLower > 0 ? (bbLower - close) / bbLower : 0;
          const rsiScore = (rsiLow - r) / rsiLow;
          const score = bandScore + rsiScore;

          if (!buy.has(date)) buy.set(date, []);
          buy.get(date)!.push({ stockCode: code, score });
        }

        // 매도: 종가 ≥ 상단밴드 또는 RSI 과매수
        if (close >= bbUpper || r >= rsiHigh) {
          if (!sell.has(date)) sell.set(date, new Set());
          sell.get(date)!.add(code);
        }
      }
    }

    // 매수 시그널 정렬
    for (const [, signals] of buy) {
      signals.sort((a, b) => b.score - a.score);
    }

    return { buy, sell };
  }
};
