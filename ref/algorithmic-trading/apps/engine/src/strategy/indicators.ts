import type { Candle } from '@trading/shared/types';

/** 캔들에서 종가 추출 (수정주가 우선) */
function getClose(candle: Candle): number {
  return candle.adjClose ?? candle.close;
}

/**
 * SMA (Simple Moving Average)
 * 단순 합산 방식 — 슬라이딩 윈도우 대비 부동소수점 누적 오차 방지
 */
export function sma(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (period <= 0 || candles.length < period) return result;

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += getClose(candles[j]!);
    }
    result[i] = sum / period;
  }
  return result;
}

/**
 * EMA (Exponential Moving Average)
 * Seed: SMA(0..period-1), 이후 EMA = prev × (1-α) + close × α
 * null 범위: [0..period-2]
 */
export function ema(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (period <= 0 || candles.length < period) return result;

  // Seed: SMA of first `period` candles
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += getClose(candles[i]!);
  }
  let prev = sum / period;
  result[period - 1] = prev;

  const alpha = 2 / (period + 1);
  for (let i = period; i < candles.length; i++) {
    prev = prev * (1 - alpha) + getClose(candles[i]!) * alpha;
    result[i] = prev;
  }
  return result;
}

/**
 * RSI (Relative Strength Index) — Wilder's smoothing
 * 첫 period 구간: 단순평균 gain/loss → 이후 Wilder smoothing
 * null 범위: [0..period] (period개의 변화량 필요 → period+1개 데이터)
 */
export function rsi(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (period <= 0 || candles.length < period + 1) return result;

  // 변화량 계산
  const changes: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    changes.push(getClose(candles[i]!) - getClose(candles[i - 1]!));
  }

  // 첫 period 구간 단순 평균
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const c = changes[i]!;
    if (c > 0) avgGain += c;
    else avgLoss += Math.abs(c);
  }
  avgGain /= period;
  avgLoss /= period;

  const calcRsi = (ag: number, al: number): number => {
    if (al === 0) return 100;
    if (ag === 0) return 0;
    return 100 - 100 / (1 + ag / al);
  };

  result[period] = calcRsi(avgGain, avgLoss);

  // Wilder smoothing
  for (let i = period; i < changes.length; i++) {
    const change = changes[i]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i + 1] = calcRsi(avgGain, avgLoss);
  }

  return result;
}

/**
 * Bollinger Bands (중심선 = SMA, 상단/하단 = SMA ± k×σ)
 * null 범위: [0..period-2]
 */
export function bollingerBands(
  candles: Candle[],
  period: number,
  k: number = 2
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const upper: (number | null)[] = new Array(candles.length).fill(null);
  const middle: (number | null)[] = new Array(candles.length).fill(null);
  const lower: (number | null)[] = new Array(candles.length).fill(null);
  if (period <= 0 || candles.length < period) return { upper, middle, lower };

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += getClose(candles[j]!);
    const mean = sum / period;

    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      variance += (getClose(candles[j]!) - mean) ** 2;
    }
    const std = Math.sqrt(variance / period);

    middle[i] = mean;
    upper[i] = mean + k * std;
    lower[i] = mean - k * std;
  }
  return { upper, middle, lower };
}

/**
 * Donchian Channel (N일 최고가/최저가)
 * upper: N일간 최고가, lower: N일간 최저가
 * null 범위: [0..period-2]
 */
export function donchianChannel(
  candles: Candle[],
  period: number
): { upper: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = new Array(candles.length).fill(null);
  const lower: (number | null)[] = new Array(candles.length).fill(null);
  if (period <= 0 || candles.length < period) return { upper, lower };

  for (let i = period - 1; i < candles.length; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j]!.high > hi) hi = candles[j]!.high;
      if (candles[j]!.low < lo) lo = candles[j]!.low;
    }
    upper[i] = hi;
    lower[i] = lo;
  }
  return { upper, lower };
}

/**
 * ATR (Average True Range) — Wilder's smoothing
 * True Range = max(H-L, |H-prevC|, |L-prevC|)
 * 첫 값: period개 TR의 단순 평균
 * null 범위: [0..period-1]
 */
export function atr(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (period <= 0 || candles.length < period + 1) return result;

  // True Range 계산 (첫 캔들은 TR 계산 불가)
  const trValues: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i]!;
    const prevCandle = candles[i - 1]!;
    const high = candle.high;
    const low = candle.low;
    const prevClose = getClose(prevCandle);
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trValues.push(tr);
  }

  // 첫 period개 TR의 단순 평균
  let atrVal = 0;
  for (let i = 0; i < period; i++) {
    atrVal += trValues[i]!;
  }
  atrVal /= period;
  result[period] = atrVal;

  // Wilder smoothing
  for (let i = period; i < trValues.length; i++) {
    atrVal = (atrVal * (period - 1) + trValues[i]!) / period;
    result[i + 1] = atrVal;
  }

  return result;
}
