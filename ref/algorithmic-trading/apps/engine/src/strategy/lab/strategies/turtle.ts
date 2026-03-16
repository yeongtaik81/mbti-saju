/**
 * 터틀 트레이딩 (Turtle Trading)
 * 돈치안 채널 돌파 진입, exit 채널 이탈 청산
 */
import type { Candle } from '@trading/shared/types';
import { donchianChannel, atr } from '../../indicators.js';
import type {
  LabStrategy,
  SignalMap,
  RankedSignal,
  ParamFieldDef
} from '../types.js';
import { STRATEGY_TYPE } from '../types.js';

export const turtleStrategy: LabStrategy = {
  type: STRATEGY_TYPE.TURTLE,
  name: '터틀 트레이딩',
  description: '돈치안 채널 N일 최고가 돌파 매수, exit 채널 최저가 이탈 매도.',

  paramSchema: [
    {
      key: 'entryPeriod',
      label: '진입 채널 (일)',
      type: 'number',
      min: 10,
      max: 80,
      step: 5,
      default: 20
    },
    {
      key: 'exitPeriod',
      label: '청산 채널 (일)',
      type: 'number',
      min: 5,
      max: 40,
      step: 5,
      default: 10
    },
    {
      key: 'atrPeriod',
      label: 'ATR 기간',
      type: 'number',
      min: 10,
      max: 30,
      step: 2,
      default: 14
    },
    {
      key: 'atrMultiple',
      label: 'ATR 배수',
      type: 'number',
      min: 1,
      max: 4,
      step: 0.5,
      default: 2,
      description: '포지션 사이징에 사용'
    }
  ] satisfies ParamFieldDef[],

  minLookback(params) {
    return (
      Math.max(
        params['entryPeriod'] ?? 20,
        params['exitPeriod'] ?? 10,
        params['atrPeriod'] ?? 14
      ) + 5
    );
  },

  generateSignals(stockCandles, allDates, params): SignalMap {
    const entryPeriod = params['entryPeriod'] ?? 20;
    const exitPeriod = params['exitPeriod'] ?? 10;
    const atrPeriod = params['atrPeriod'] ?? 14;

    const buy = new Map<string, RankedSignal[]>();
    const sell = new Map<string, Set<string>>();

    for (const [code, candles] of stockCandles) {
      const lookback = Math.max(entryPeriod, exitPeriod, atrPeriod) + 2;
      if (candles.length < lookback) continue;

      const dc = donchianChannel(candles, entryPeriod);
      const exitDc = donchianChannel(candles, exitPeriod);
      const atrVals = atr(candles, atrPeriod);

      for (let i = 1; i < candles.length; i++) {
        const prevUpper = dc.upper[i - 1]; // 전일 N일 최고가
        const prevExitLower = exitDc.lower[i - 1]; // 전일 exit 채널 최저가 (당일 low 미포함)
        const close = candles[i]!.adjClose ?? candles[i]!.close;
        const high = candles[i]!.high;
        const currentAtr = atrVals[i];

        if (prevUpper == null) continue;

        const date = candles[i]!.date;

        // 매수: 고가가 전일 N일 최고가 돌파
        if (high > prevUpper) {
          // 스코어: 돌파 강도 (prevUpper 대비 high의 비율) + ATR 역수 (변동성 낮을수록 안정)
          const breakoutScore =
            prevUpper > 0 ? (high - prevUpper) / prevUpper : 0;
          const atrScore =
            currentAtr != null && currentAtr > 0 ? 1 / currentAtr : 0;
          const score = breakoutScore + atrScore * 0.01;

          if (!buy.has(date)) buy.set(date, []);
          buy.get(date)!.push({ stockCode: code, score });
        }

        // 매도: 종가가 전일 exit 채널 최저가 이탈 (당일 low 미포함이므로 정상 캔들에서도 가능)
        if (prevExitLower != null && close < prevExitLower) {
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
