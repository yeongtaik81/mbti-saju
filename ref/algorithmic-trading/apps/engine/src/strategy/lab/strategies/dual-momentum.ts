/**
 * 듀얼 모멘텀 (Dual Momentum)
 * 절대 모멘텀(수익률 > 0) + 상대 모멘텀(상위 N종목 랭킹)
 * 리밸런싱 주기마다 포트폴리오 교체
 */
import type { Candle } from '@trading/shared/types';
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

export const dualMomentumStrategy: LabStrategy = {
  type: STRATEGY_TYPE.DUAL_MOMENTUM,
  name: '듀얼 모멘텀',
  description:
    '절대 + 상대 모멘텀 기반. lookback 기간 수익률 양수인 종목 중 상위 N개 선택, holdDays 간격 리밸런싱.',

  paramSchema: [
    {
      key: 'lookback',
      label: 'Lookback (일)',
      type: 'number',
      min: 10,
      max: 200,
      step: 5,
      default: 60,
      description: '모멘텀 측정 기간'
    },
    {
      key: 'holdDays',
      label: '리밸런싱 주기 (일)',
      type: 'number',
      min: 5,
      max: 60,
      step: 5,
      default: 20,
      description: '포트폴리오 교체 주기'
    },
    {
      key: 'topN',
      label: 'Top N 종목',
      type: 'number',
      min: 1,
      max: 20,
      step: 1,
      default: 5,
      description: '상위 N개 종목 선택'
    }
  ] satisfies ParamFieldDef[],

  minLookback(params) {
    return (params['lookback'] ?? 60) + 5;
  },

  generateSignals(stockCandles, allDates, params): SignalMap {
    const lookback = params['lookback'] ?? 60;
    const holdDays = params['holdDays'] ?? 20;
    const topN = params['topN'] ?? 5;

    const buy = new Map<string, RankedSignal[]>();
    const sell = new Map<string, Set<string>>();
    const stockCodes = [...stockCandles.keys()];

    // 종목별 date→index 맵 생성
    const dateIndexMaps = new Map<string, Map<string, number>>();
    for (const [code, candles] of stockCandles) {
      const m = new Map<string, number>();
      for (let i = 0; i < candles.length; i++) m.set(candles[i]!.date, i);
      dateIndexMaps.set(code, m);
    }

    for (let di = lookback; di < allDates.length; di += holdDays) {
      const date = allDates[di]!;
      const prevDate = allDates[di - lookback]!;

      const momentums: RankedSignal[] = [];
      for (const code of stockCodes) {
        const candles = stockCandles.get(code)!;
        const dateMap = dateIndexMaps.get(code)!;
        const todayIdx = dateMap.get(date);
        const pastIdx = dateMap.get(prevDate);
        if (todayIdx == null || pastIdx == null) continue;

        const todayClose = getClose(candles[todayIdx]!);
        const pastClose = getClose(candles[pastIdx]!);
        if (pastClose <= 0) continue;

        const ret = (todayClose - pastClose) / pastClose;
        // 절대 모멘텀: 양수만
        if (ret > 0) {
          momentums.push({ stockCode: code, score: ret });
        }
      }

      // 상대 모멘텀: 수익률 내림차순
      momentums.sort((a, b) => b.score - a.score);
      buy.set(date, momentums.slice(0, topN));

      // 미선정 종목 매도
      const selected = new Set(
        momentums.slice(0, topN).map((m) => m.stockCode)
      );
      const sellSet = new Set<string>();
      for (const code of stockCodes) {
        if (!selected.has(code)) sellSet.add(code);
      }
      sell.set(date, sellSet);
    }

    return { buy, sell };
  }
};
