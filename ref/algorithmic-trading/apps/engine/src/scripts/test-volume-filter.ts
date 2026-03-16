/**
 * 거래대금 필터별 전략 성과 비교
 *
 * 가설: 거래대금이 높은 종목일수록 전략 PF가 좋아진다
 * 테스트 임계값: 1억, 5억, 10억, 30억, 50억, 100억 (일평균 거래대금)
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

// ── 거래대금 기준 종목 분류 ──
const stockAvgAmount = new Map<string, number>();
const rows = db
  .prepare(
    `SELECT stock_code, AVG(amount) as avg_amt
   FROM daily_candles WHERE amount > 0
   GROUP BY stock_code`
  )
  .all() as { stock_code: string; avg_amt: number }[];

for (const r of rows) {
  stockAvgAmount.set(r.stock_code, r.avg_amt);
}

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

// ── breadth 계산 ──
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

interface Trade {
  returnPct: number;
  slTriggered: boolean;
}

// ── 상승장: MA 지지 ──
function runMaSupport(codes: Set<string>, useSL: boolean): Trade[] {
  const trades: Trade[] = [];
  for (const [code, candles] of allCandles) {
    if (!codes.has(code)) continue;
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
function runBreakout(codes: Set<string>, useSL: boolean): Trade[] {
  const trades: Trade[] = [];
  const K = 0.4;
  for (const [code, candles] of allCandles) {
    if (!codes.has(code)) continue;
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

  // MDD
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
    maxWin: (returns[returns.length - 1]! * 100).toFixed(1),
    maxLoss: (returns[0]! * 100).toFixed(1),
    slRate: ((slCount / trades.length) * 100).toFixed(1),
    mdd: (maxDD * 100).toFixed(1)
  };
}

// ── 거래대금 임계값별 테스트 ──
const thresholds = [
  { label: '전체 (필터 없음)', min: 0 },
  { label: '1억+', min: 1_0000_0000 },
  { label: '5억+', min: 5_0000_0000 },
  { label: '10억+', min: 10_0000_0000 },
  { label: '30억+', min: 30_0000_0000 },
  { label: '50억+', min: 50_0000_0000 },
  { label: '100억+', min: 100_0000_0000 }
];

console.log('=== 거래대금 필터별 전략 성과 비교 ===');
console.log(`전체 종목: ${allCandles.size}개\n`);

// 헤더
console.log('━━━ 상승장: MA 지지 (SL=-7%) ━━━');
console.log(
  '거래대금     | 종목수 | 거래수  | 평균수익 | 중앙값  | 승률   | PF   | 최대손실 | SL발동 | MDD'
);
console.log('─'.repeat(110));

for (const { label, min } of thresholds) {
  const codes = new Set<string>();
  for (const [code] of allCandles) {
    const amt = stockAvgAmount.get(code) ?? 0;
    if (amt >= min) codes.add(code);
  }

  const trades = runMaSupport(codes, true);
  const s = calcStats(trades);
  if (!s) {
    console.log(
      `${label.padEnd(12)} | ${String(codes.size).padStart(5)} | 거래 없음`
    );
    continue;
  }
  console.log(
    `${label.padEnd(12)} | ${String(codes.size).padStart(5)} | ${String(s.count).padStart(6)} | ` +
      `${s.avg.padStart(7)}% | ${s.median.padStart(6)}% | ${s.winRate.padStart(5)}% | ${s.pf.padStart(4)} | ` +
      `${s.maxLoss.padStart(7)}% | ${s.slRate.padStart(5)}% | ${s.mdd.padStart(6)}%`
  );
}

console.log('\n━━━ 하락장: 변동성 돌파 (SL=-7%) ━━━');
console.log(
  '거래대금     | 종목수 | 거래수  | 평균수익 | 중앙값  | 승률   | PF   | 최대손실 | SL발동 | MDD'
);
console.log('─'.repeat(110));

for (const { label, min } of thresholds) {
  const codes = new Set<string>();
  for (const [code] of allCandles) {
    const amt = stockAvgAmount.get(code) ?? 0;
    if (amt >= min) codes.add(code);
  }

  const trades = runBreakout(codes, true);
  const s = calcStats(trades);
  if (!s) {
    console.log(
      `${label.padEnd(12)} | ${String(codes.size).padStart(5)} | 거래 없음`
    );
    continue;
  }
  console.log(
    `${label.padEnd(12)} | ${String(codes.size).padStart(5)} | ${String(s.count).padStart(6)} | ` +
      `${s.avg.padStart(7)}% | ${s.median.padStart(6)}% | ${s.winRate.padStart(5)}% | ${s.pf.padStart(4)} | ` +
      `${s.maxLoss.padStart(7)}% | ${s.slRate.padStart(5)}% | ${s.mdd.padStart(6)}%`
  );
}

// ── 복합 전략 ──
console.log('\n━━━ 복합 (상승장+하락장, SL=-7%) ━━━');
console.log(
  '거래대금     | 종목수 | 거래수  | 평균수익 | 중앙값  | 승률   | PF   | 최대손실 | SL발동 | MDD'
);
console.log('─'.repeat(110));

for (const { label, min } of thresholds) {
  const codes = new Set<string>();
  for (const [code] of allCandles) {
    const amt = stockAvgAmount.get(code) ?? 0;
    if (amt >= min) codes.add(code);
  }

  const bull = runMaSupport(codes, true);
  const bear = runBreakout(codes, true);
  const all = [...bull, ...bear].sort(() => 0); // 시간순 불필요, 단순 합산
  const s = calcStats(all);
  if (!s) {
    console.log(
      `${label.padEnd(12)} | ${String(codes.size).padStart(5)} | 거래 없음`
    );
    continue;
  }
  console.log(
    `${label.padEnd(12)} | ${String(codes.size).padStart(5)} | ${String(s.count).padStart(6)} | ` +
      `${s.avg.padStart(7)}% | ${s.median.padStart(6)}% | ${s.winRate.padStart(5)}% | ${s.pf.padStart(4)} | ` +
      `${s.maxLoss.padStart(7)}% | ${s.slRate.padStart(5)}% | ${s.mdd.padStart(6)}%`
  );
}

// ── SL 없음도 비교 ──
console.log('\n\n━━━ 복합 (SL 없음) — 참고 비교 ━━━');
console.log(
  '거래대금     | 종목수 | 거래수  | 평균수익 | 중앙값  | 승률   | PF   | 최대손실 | MDD'
);
console.log('─'.repeat(100));

for (const { label, min } of thresholds) {
  const codes = new Set<string>();
  for (const [code] of allCandles) {
    const amt = stockAvgAmount.get(code) ?? 0;
    if (amt >= min) codes.add(code);
  }

  const bull = runMaSupport(codes, false);
  const bear = runBreakout(codes, false);
  const all = [...bull, ...bear];
  const s = calcStats(all);
  if (!s) {
    console.log(
      `${label.padEnd(12)} | ${String(codes.size).padStart(5)} | 거래 없음`
    );
    continue;
  }
  console.log(
    `${label.padEnd(12)} | ${String(codes.size).padStart(5)} | ${String(s.count).padStart(6)} | ` +
      `${s.avg.padStart(7)}% | ${s.median.padStart(6)}% | ${s.winRate.padStart(5)}% | ${s.pf.padStart(4)} | ` +
      `${s.maxLoss.padStart(7)}% | ${s.mdd.padStart(6)}%`
  );
}

db.close();
