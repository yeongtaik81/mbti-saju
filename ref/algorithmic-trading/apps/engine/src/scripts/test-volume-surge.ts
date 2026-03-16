/**
 * 거래량 증가율(surge) 필터별 전략 성과 비교
 *
 * 가설: 매수 시점의 거래량이 평소 대비 급증한 경우 모멘텀이 실려 수익률이 높다
 *
 * 테스트 지표:
 * 1. Volume Ratio: 당일 거래량 / 20일 평균 거래량 (≥1.5, ≥2.0, ≥3.0)
 * 2. Volume Slope: 5일 거래량 이동평균의 기울기 (상승 중인지)
 * 3. Amount Ratio: 당일 거래대금 / 20일 평균 거래대금
 * 4. 복합: 기본 거래대금 필터(30억+) + Volume Ratio
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import Database from 'better-sqlite3';
import { sma, rsi } from '../strategy/indicators.js';
import type { Candle } from '@trading/shared/types';

const DB_PATH =
  process.env['DB_PATH'] || path.resolve(__dirname, '../../data/trading.db');
const db = new Database(DB_PATH, { readonly: true });

const HOLD_DAYS = 7;
const SL = -0.07;

// ── 데이터 로드 ──
const stockCodes = (
  db
    .prepare(
      'SELECT DISTINCT stock_code FROM daily_candles ORDER BY stock_code'
    )
    .all() as { stock_code: string }[]
).map((r) => r.stock_code);

const getDailyCandles = db.prepare<[string]>(
  `SELECT stock_code AS stockCode, date, open, high, low, close, adj_close AS adjClose, volume, amount
   FROM daily_candles WHERE stock_code = ? ORDER BY date ASC`
);

const allCandles = new Map<string, Candle[]>();
for (const code of stockCodes) {
  const candles = getDailyCandles.all(code) as Candle[];
  if (candles.length > 60) allCandles.set(code, candles);
}

// ── 거래대금 기준 ──
const stockAvgAmount = new Map<string, number>();
{
  const rows = db
    .prepare(
      `SELECT stock_code, AVG(amount) as avg_amt FROM daily_candles WHERE amount > 0 GROUP BY stock_code`
    )
    .all() as { stock_code: string; avg_amt: number }[];
  for (const r of rows) stockAvgAmount.set(r.stock_code, r.avg_amt);
}

// ── breadth ──
function computeDailyBreadth(): Map<string, number> {
  const dateMap = new Map<string, { above: number; total: number }>();
  for (const [, candles] of allCandles) {
    const ma20 = sma(candles, 20);
    for (let i = 0; i < candles.length; i++) {
      const date = candles[i]!.date;
      if (ma20[i] === null || ma20[i] === undefined) continue;
      if (!dateMap.has(date)) dateMap.set(date, { above: 0, total: 0 });
      const entry = dateMap.get(date)!;
      entry.total++;
      if (candles[i]!.close > ma20[i]!) entry.above++;
    }
  }
  const breadth = new Map<string, number>();
  for (const [date, { above, total }] of dateMap) {
    breadth.set(date, total > 0 ? above / total : 0);
  }
  return breadth;
}

const breadth = computeDailyBreadth();
const allDates = Array.from(breadth.keys()).sort();
const prevBreadth = new Map<string, number>();
for (let i = 1; i < allDates.length; i++) {
  prevBreadth.set(allDates[i]!, breadth.get(allDates[i - 1]!) ?? 0);
}

// ── 거래량 지표 사전 계산 ──
// 각 종목별, 캔들 인덱스별 지표
interface VolMetrics {
  volumeRatio: (number | null)[]; // 당일 거래량 / 20일 평균
  amountRatio: (number | null)[]; // 당일 거래대금 / 20일 평균
  volumeSlope5: (number | null)[]; // 5일 거래량 MA 기울기 (정규화)
  volumeSlope10: (number | null)[]; // 10일 거래량 MA 기울기 (정규화)
}

const volMetrics = new Map<string, VolMetrics>();

for (const [code, candles] of allCandles) {
  const vr: (number | null)[] = new Array(candles.length).fill(null);
  const ar: (number | null)[] = new Array(candles.length).fill(null);
  const vs5: (number | null)[] = new Array(candles.length).fill(null);
  const vs10: (number | null)[] = new Array(candles.length).fill(null);

  // 20일 평균 거래량/거래대금 (rolling)
  for (let i = 20; i < candles.length; i++) {
    let sumVol = 0,
      sumAmt = 0;
    for (let j = i - 20; j < i; j++) {
      sumVol += candles[j]!.volume;
      sumAmt += candles[j]!.amount ?? 0;
    }
    const avgVol = sumVol / 20;
    const avgAmt = sumAmt / 20;
    vr[i] = avgVol > 0 ? candles[i]!.volume / avgVol : null;
    ar[i] = avgAmt > 0 ? (candles[i]!.amount ?? 0) / avgAmt : null;
  }

  // 5일 거래량 MA의 기울기 (현재 5MA vs 5일 전 5MA, 정규화)
  const vol5ma: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = 4; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - 4; j <= i; j++) sum += candles[j]!.volume;
    vol5ma[i] = sum / 5;
  }
  for (let i = 9; i < candles.length; i++) {
    const cur = vol5ma[i];
    const prev = vol5ma[i - 5];
    if (cur && prev && prev > 0) {
      vs5[i] = (cur - prev) / prev; // % 변화
    }
  }

  // 10일 거래량 MA의 기울기
  const vol10ma: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = 9; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - 9; j <= i; j++) sum += candles[j]!.volume;
    vol10ma[i] = sum / 10;
  }
  for (let i = 19; i < candles.length; i++) {
    const cur = vol10ma[i];
    const prev = vol10ma[i - 10];
    if (cur && prev && prev > 0) {
      vs10[i] = (cur - prev) / prev;
    }
  }

  volMetrics.set(code, {
    volumeRatio: vr,
    amountRatio: ar,
    volumeSlope5: vs5,
    volumeSlope10: vs10
  });
}

// ── 필터 타입 ──
type VolFilter = (code: string, idx: number) => boolean;

interface Trade {
  returnPct: number;
  slTriggered: boolean;
}

// ── 상승장: MA 지지 ──
function runMaSupport(volFilter: VolFilter, useSL: boolean): Trade[] {
  const trades: Trade[] = [];
  for (const [code, candles] of allCandles) {
    const shortMa = sma(candles, 10);
    const longMa = sma(candles, 60);

    for (let i = 60; i < candles.length - HOLD_DAYS - 1; i++) {
      const today = candles[i]!;
      const pb = prevBreadth.get(today.date);
      if (pb === undefined || pb < 0.5) continue;
      const sm = shortMa[i];
      const lm = longMa[i];
      if (sm === null || sm === undefined || lm === null || lm === undefined)
        continue;
      if (sm <= lm) continue;
      const proximity = today.close / lm;
      if (proximity > 1.02 || proximity < 0.98) continue;

      // 거래량 필터 적용
      if (!volFilter(code, i)) continue;

      const buyPrice = candles[i + 1]!.open;
      let sellDay = HOLD_DAYS;
      let slTriggered = false;

      if (useSL) {
        for (let d = 1; d <= HOLD_DAYS; d++) {
          const fc = candles[i + 1 + d];
          if (!fc) break;
          if ((fc.low - buyPrice) / buyPrice <= SL) {
            sellDay = d;
            slTriggered = true;
            break;
          }
        }
      }

      const sellIdx = i + 1 + sellDay;
      if (sellIdx >= candles.length) continue;
      const sellPrice = slTriggered
        ? buyPrice * (1 + SL)
        : candles[sellIdx]!.open;
      trades.push({
        returnPct: (sellPrice - buyPrice) / buyPrice,
        slTriggered
      });
    }
  }
  return trades;
}

// ── 하락장: 변동성 돌파 ──
function runBreakout(volFilter: VolFilter, useSL: boolean): Trade[] {
  const trades: Trade[] = [];
  const K = 0.4;
  for (const [code, candles] of allCandles) {
    const shortMa = sma(candles, 10);
    const longMa = sma(candles, 60);
    const rsiValues = rsi(candles, 14);

    for (let i = 60; i < candles.length - HOLD_DAYS - 1; i++) {
      const prev = candles[i - 1]!;
      const today = candles[i]!;
      const pb = prevBreadth.get(today.date);
      if (pb === undefined || pb >= 0.4) continue;
      const prevRange = prev.high - prev.low;
      if (prevRange <= 0) continue;
      const breakoutThreshold = today.open + prevRange * K;
      if (today.high < breakoutThreshold) continue;
      const sm = shortMa[i];
      const lm = longMa[i];
      const curRsi = rsiValues[i];
      if (sm === null || sm === undefined || lm === null || lm === undefined)
        continue;
      if (curRsi === null || curRsi === undefined) continue;
      if (sm <= lm || curRsi < 20 || curRsi > 80) continue;

      // 거래량 필터 적용
      if (!volFilter(code, i)) continue;

      const buyPrice = breakoutThreshold;
      let sellDay = HOLD_DAYS;
      let slTriggered = false;

      if (useSL) {
        for (let d = 0; d <= HOLD_DAYS; d++) {
          const fc = candles[i + d];
          if (!fc) break;
          if ((fc.low - buyPrice) / buyPrice <= SL) {
            sellDay = d;
            slTriggered = true;
            break;
          }
        }
      }

      const sellIdx = i + (slTriggered ? sellDay : HOLD_DAYS);
      if (sellIdx >= candles.length) continue;
      let sellPrice: number;
      if (slTriggered) {
        sellPrice = buyPrice * (1 + SL);
      } else {
        const nextIdx = i + HOLD_DAYS + 1;
        if (nextIdx >= candles.length) continue;
        sellPrice = candles[nextIdx]!.open;
      }
      trades.push({
        returnPct: (sellPrice - buyPrice) / buyPrice,
        slTriggered
      });
    }
  }
  return trades;
}

// ── 통계 ──
function calcStats(trades: Trade[]) {
  if (trades.length === 0) return null;
  const returns = trades.map((t) => t.returnPct).sort((a, b) => a - b);
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const median = returns[Math.floor(returns.length / 2)]!;
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  const winRate = wins.length / returns.length;
  const totalProfit = wins.reduce((s, r) => s + r, 0);
  const totalLoss = Math.abs(losses.reduce((s, r) => s + r, 0));
  const pf = totalLoss > 0 ? totalProfit / totalLoss : Infinity;
  const slCount = trades.filter((t) => t.slTriggered).length;

  let cum = 1,
    maxCum = 1,
    maxDD = 0;
  for (const t of trades) {
    cum *= 1 + t.returnPct;
    if (cum > maxCum) maxCum = cum;
    const dd = (cum - maxCum) / maxCum;
    if (dd < maxDD) maxDD = dd;
  }

  return {
    count: trades.length,
    avg: (avg * 100).toFixed(2),
    median: (median * 100).toFixed(2),
    winRate: (winRate * 100).toFixed(1),
    pf: pf.toFixed(2),
    maxLoss: (returns[0]! * 100).toFixed(1),
    slRate: ((slCount / trades.length) * 100).toFixed(1),
    mdd: (maxDD * 100).toFixed(1)
  };
}

function printRow(label: string, s: ReturnType<typeof calcStats>) {
  if (!s) {
    console.log(`${label.padEnd(40)} | 거래 없음`);
    return;
  }
  console.log(
    `${label.padEnd(40)} | ${String(s.count).padStart(6)} | ` +
      `${s.avg.padStart(7)}% | ${s.median.padStart(6)}% | ${s.winRate.padStart(5)}% | ${s.pf.padStart(5)} | ` +
      `${s.maxLoss.padStart(7)}% | ${s.slRate.padStart(5)}%`
  );
}

function printHeader() {
  console.log(
    '필터 조건'.padEnd(40) +
      ' | 거래수  | 평균수익 | 중앙값  | 승률   |    PF | 최대손실 | SL발동'
  );
  console.log('─'.repeat(120));
}

// ── 테스트 케이스 정의 ──
interface TestCase {
  label: string;
  filter: VolFilter;
}

// 기본 필터 (항상 true)
const noFilter: VolFilter = () => true;

// 거래대금 30억+ 기본 필터
const amt30B: VolFilter = (code) =>
  (stockAvgAmount.get(code) ?? 0) >= 30_0000_0000;

const tests: TestCase[] = [
  // A. 기준선
  { label: '(기준) 필터 없음', filter: noFilter },
  { label: '(기준) 거래대금 30억+', filter: amt30B },

  // B. Volume Ratio만 (전체 종목)
  {
    label: 'VR ≥ 1.5 (20일 대비)',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.volumeRatio[idx];
      return v !== null && v !== undefined && v >= 1.5;
    }
  },
  {
    label: 'VR ≥ 2.0',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.volumeRatio[idx];
      return v !== null && v !== undefined && v >= 2.0;
    }
  },
  {
    label: 'VR ≥ 3.0',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.volumeRatio[idx];
      return v !== null && v !== undefined && v >= 3.0;
    }
  },
  {
    label: 'VR ≥ 5.0',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.volumeRatio[idx];
      return v !== null && v !== undefined && v >= 5.0;
    }
  },

  // C. Amount Ratio (거래대금 증가율)
  {
    label: 'AR ≥ 1.5 (거래대금 20일 대비)',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.amountRatio[idx];
      return v !== null && v !== undefined && v >= 1.5;
    }
  },
  {
    label: 'AR ≥ 2.0',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.amountRatio[idx];
      return v !== null && v !== undefined && v >= 2.0;
    }
  },
  {
    label: 'AR ≥ 3.0',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.amountRatio[idx];
      return v !== null && v !== undefined && v >= 3.0;
    }
  },

  // D. Volume Slope (거래량 MA 기울기)
  {
    label: 'Slope5 > 0 (5일MA 상승)',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.volumeSlope5[idx];
      return v !== null && v !== undefined && v > 0;
    }
  },
  {
    label: 'Slope5 > 50%',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.volumeSlope5[idx];
      return v !== null && v !== undefined && v > 0.5;
    }
  },
  {
    label: 'Slope5 > 100%',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.volumeSlope5[idx];
      return v !== null && v !== undefined && v > 1.0;
    }
  },
  {
    label: 'Slope10 > 0 (10일MA 상승)',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.volumeSlope10[idx];
      return v !== null && v !== undefined && v > 0;
    }
  },
  {
    label: 'Slope10 > 50%',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.volumeSlope10[idx];
      return v !== null && v !== undefined && v > 0.5;
    }
  },

  // E. 복합: 거래대금 30억+ AND 거래량 증가
  {
    label: '30억+ AND VR ≥ 1.5',
    filter: (code, idx) => {
      if ((stockAvgAmount.get(code) ?? 0) < 30_0000_0000) return false;
      const m = volMetrics.get(code);
      const v = m?.volumeRatio[idx];
      return v !== null && v !== undefined && v >= 1.5;
    }
  },
  {
    label: '30억+ AND VR ≥ 2.0',
    filter: (code, idx) => {
      if ((stockAvgAmount.get(code) ?? 0) < 30_0000_0000) return false;
      const m = volMetrics.get(code);
      const v = m?.volumeRatio[idx];
      return v !== null && v !== undefined && v >= 2.0;
    }
  },
  {
    label: '30억+ AND AR ≥ 1.5',
    filter: (code, idx) => {
      if ((stockAvgAmount.get(code) ?? 0) < 30_0000_0000) return false;
      const m = volMetrics.get(code);
      const v = m?.amountRatio[idx];
      return v !== null && v !== undefined && v >= 1.5;
    }
  },
  {
    label: '30억+ AND AR ≥ 2.0',
    filter: (code, idx) => {
      if ((stockAvgAmount.get(code) ?? 0) < 30_0000_0000) return false;
      const m = volMetrics.get(code);
      const v = m?.amountRatio[idx];
      return v !== null && v !== undefined && v >= 2.0;
    }
  },
  {
    label: '30억+ AND Slope5 > 0',
    filter: (code, idx) => {
      if ((stockAvgAmount.get(code) ?? 0) < 30_0000_0000) return false;
      const m = volMetrics.get(code);
      const v = m?.volumeSlope5[idx];
      return v !== null && v !== undefined && v > 0;
    }
  },
  {
    label: '30억+ AND Slope5 > 50%',
    filter: (code, idx) => {
      if ((stockAvgAmount.get(code) ?? 0) < 30_0000_0000) return false;
      const m = volMetrics.get(code);
      const v = m?.volumeSlope5[idx];
      return v !== null && v !== undefined && v > 0.5;
    }
  },

  // F. VR 역방향 (거래량 감소 시 = 조용한 종목)
  {
    label: 'VR ≤ 0.5 (거래량 감소)',
    filter: (code, idx) => {
      const m = volMetrics.get(code);
      const v = m?.volumeRatio[idx];
      return v !== null && v !== undefined && v <= 0.5;
    }
  },
  {
    label: '30억+ AND VR ≤ 0.8 (조용한 대형주)',
    filter: (code, idx) => {
      if ((stockAvgAmount.get(code) ?? 0) < 30_0000_0000) return false;
      const m = volMetrics.get(code);
      const v = m?.volumeRatio[idx];
      return v !== null && v !== undefined && v <= 0.8;
    }
  }
];

// ── 실행 ──
console.log('=== 거래량 증가율 필터별 전략 성과 비교 (SL=-7%) ===');
console.log(`전체 종목: ${allCandles.size}개\n`);

console.log('━━━ 복합 전략 (상승장 MA지지 + 하락장 변동성돌파, SL=-7%) ━━━\n');
printHeader();

for (const t of tests) {
  const bull = runMaSupport(t.filter, true);
  const bear = runBreakout(t.filter, true);
  const all = [...bull, ...bear];
  printRow(t.label, calcStats(all));
}

// ── 각 전략 개별 결과 (상위 필터만) ──
const topFilters = tests.filter(
  (_, i) => i <= 1 || [2, 3, 6, 7, 9, 10, 15, 16, 17, 18].includes(i)
);

console.log('\n\n━━━ 상승장 MA지지만 (SL=-7%) ━━━\n');
printHeader();
for (const t of topFilters) {
  printRow(t.label, calcStats(runMaSupport(t.filter, true)));
}

console.log('\n\n━━━ 하락장 변동성돌파만 (SL=-7%) ━━━\n');
printHeader();
for (const t of topFilters) {
  printRow(t.label, calcStats(runBreakout(t.filter, true)));
}

db.close();
