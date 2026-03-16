/**
 * 변동성 돌파 (Volatility Breakout)
 * 당일 시가 + K × 전일 레인지 돌파 시 매수
 * MA 골든크로스 + RSI 필터 병행
 */
import type { Candle } from '@trading/shared/types';
import { sma, rsi } from '../../indicators.js';
import type {
  LabStrategy,
  SignalMap,
  RankedSignal,
  ParamFieldDef
} from '../types.js';
import { STRATEGY_TYPE } from '../types.js';

function getClose(c: Candle): number {
  return c.adjClose ?? c.close;
}

export const volatilityBreakoutStrategy: LabStrategy = {
  type: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
  name: '변동성 돌파',
  description:
    '전일 고가-저가 레인지의 K배 이상 상승 돌파 매수. MA/RSI 필터 병행.',

  paramSchema: [
    {
      key: 'k',
      label: 'K (변동성 계수)',
      type: 'number',
      min: 0.1,
      max: 1.0,
      step: 0.1,
      default: 0.5
    },
    {
      key: 'shortMaPeriod',
      label: '단기 MA',
      type: 'number',
      min: 3,
      max: 20,
      step: 1,
      default: 5
    },
    {
      key: 'longMaPeriod',
      label: '장기 MA',
      type: 'number',
      min: 10,
      max: 120,
      step: 5,
      default: 20
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
      label: 'RSI 하한',
      type: 'number',
      min: 10,
      max: 50,
      step: 5,
      default: 30
    },
    {
      key: 'rsiHigh',
      label: 'RSI 상한',
      type: 'number',
      min: 50,
      max: 90,
      step: 5,
      default: 70
    }
  ] satisfies ParamFieldDef[],

  minLookback(params) {
    return (
      Math.max(params['longMaPeriod'] ?? 20, params['rsiPeriod'] ?? 14) + 5
    );
  },

  generateSignals(stockCandles, allDates, params): SignalMap {
    const k = params['k'] ?? 0.5;
    const shortMaPeriod = params['shortMaPeriod'] ?? 5;
    const longMaPeriod = params['longMaPeriod'] ?? 20;
    const rsiPeriod = params['rsiPeriod'] ?? 14;
    const rsiLow = params['rsiLow'] ?? 30;
    const rsiHigh = params['rsiHigh'] ?? 70;

    const buy = new Map<string, RankedSignal[]>();
    const sell = new Map<string, Set<string>>();

    for (const [code, candles] of stockCandles) {
      const minLen = Math.max(longMaPeriod, rsiPeriod) + 2;
      if (candles.length < minLen) continue;

      const shortMa = sma(candles, shortMaPeriod);
      const longMa = sma(candles, longMaPeriod);
      const rsiVals = rsi(candles, rsiPeriod);

      for (let i = 2; i < candles.length; i++) {
        const prev = candles[i - 1]!;
        const today = candles[i]!;
        const date = today.date; // 관찰일 (시뮬레이터가 T+1 체결)

        // 전일 레인지
        const prevRange = prev.high - prev.low;
        if (prevRange <= 0) continue;

        // 돌파 기준: 당일 고가가 시가 + K × 전일레인지 초과 (장중 돌파 확인)
        const breakoutThreshold = today.open + k * prevRange;

        // 지표 (전일 기준 — 룩어헤드 없음)
        const sm = shortMa[i - 1];
        const lm = longMa[i - 1];
        const currentRsi = rsiVals[i - 1];

        // 조건 체크 (high 기반 돌파 — 종가 대신 장중 확인)
        const breakoutMet = today.high > breakoutThreshold;
        const maCrossMet = sm != null && lm != null && sm > lm;
        const rsiMet =
          currentRsi != null && currentRsi >= rsiLow && currentRsi <= rsiHigh;

        // 매수: 3조건 충족 (시뮬레이터가 T+1 시가에 체결)
        if (breakoutMet && maCrossMet && rsiMet) {
          const breakoutScore =
            breakoutThreshold > 0
              ? (today.high - breakoutThreshold) / breakoutThreshold
              : 0;

          if (!buy.has(date)) buy.set(date, []);
          buy.get(date)!.push({ stockCode: code, score: breakoutScore });
        }

        // 매도: RSI 과매수 또는 데드크로스 (시뮬레이터가 T+1 시가에 체결)
        const overbought = currentRsi != null && currentRsi >= rsiHigh;
        const deadCross =
          sm != null &&
          lm != null &&
          shortMa[i - 2] != null &&
          longMa[i - 2] != null &&
          shortMa[i - 2]! >= longMa[i - 2]! &&
          sm < lm;

        if (overbought || deadCross) {
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
