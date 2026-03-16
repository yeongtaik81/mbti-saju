/**
 * 종목 유니버스 필터 비교 백테스트
 *
 * 비교 대상:
 *   1. 전체 종목 (baseline)
 *   2. 거래대금 상위 50개
 *   3. 거래대금 상위 100개
 *   4. 거래량 급증 종목 (당일 거래량 > N배 × 20일 평균)
 *   5. 거래대금 상위 50 + 거래량 급증 합집합
 *
 * 전략: MA10/50 + Turtle40/20 (전략 A), MA5/20 + Turtle20/10 (전략 B)
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import Database from 'better-sqlite3';
import { sma, donchianChannel } from '../strategy/indicators.js';
import type { Candle } from '@trading/shared/types';

const DB_PATH =
  process.env['DB_PATH'] || path.resolve(__dirname, '../../data/trading.db');
const db = new Database(DB_PATH, { readonly: true });

// ── 비용 상수 ──
const SLIPPAGE = 0.001;
const FEE_RATE = 0.00015;
const TAX_RATE = 0.0018;
const INITIAL_CAPITAL = 10_000_000;

// ── 데이터 로드 ──
const stockCodes = (
  db
    .prepare(
      'SELECT DISTINCT stock_code FROM daily_candles ORDER BY stock_code'
    )
    .all() as { stock_code: string }[]
).map((r) => r.stock_code);

const allDates = (
  db
    .prepare('SELECT DISTINCT date FROM daily_candles ORDER BY date ASC')
    .all() as { date: string }[]
).map((r) => r.date);

console.log(`=== 종목 유니버스 필터 비교 ===`);
console.log(`전체 종목: ${stockCodes.length}개, 거래일: ${allDates.length}일`);
console.log(`기간: ${allDates[0]} ~ ${allDates[allDates.length - 1]}\n`);

// 종목별 일봉 로드
const stockCandles = new Map<string, Candle[]>();
for (const code of stockCodes) {
  stockCandles.set(
    code,
    db
      .prepare(
        `SELECT stock_code AS stockCode, date, open, high, low, close, adj_close AS adjClose, volume, amount
     FROM daily_candles WHERE stock_code = ? ORDER BY date ASC`
      )
      .all(code) as Candle[]
  );
}

// 날짜→인덱스
const dateIndexMap = new Map<string, number>();
allDates.forEach((d, i) => dateIndexMap.set(d, i));

// ══════════════════════════════════════════
// 유니버스 필터 생성기
// ══════════════════════════════════════════

/** 일별 거래대금 상위 N개 종목 반환 */
function topAmountUniverse(
  topN: number,
  lookbackDays: number = 20
): Map<string, Set<string>> {
  const universe = new Map<string, Set<string>>();

  for (const date of allDates) {
    const rankings: { code: string; avgAmount: number }[] = [];

    for (const code of stockCodes) {
      const candles = stockCandles.get(code)!;
      const todayIdx = candles.findIndex((c) => c.date === date);
      if (todayIdx < lookbackDays) continue;

      // 최근 lookbackDays일 평균 거래대금
      let totalAmount = 0;
      let count = 0;
      for (let j = todayIdx - lookbackDays + 1; j <= todayIdx; j++) {
        const amt = candles[j]?.amount ?? 0;
        if (amt > 0) {
          totalAmount += amt;
          count++;
        }
      }
      if (count === 0) continue;
      rankings.push({ code, avgAmount: totalAmount / count });
    }

    rankings.sort((a, b) => b.avgAmount - a.avgAmount);
    universe.set(date, new Set(rankings.slice(0, topN).map((r) => r.code)));
  }

  return universe;
}

/** 일별 거래량 급증 종목 (당일 거래량 > threshold × 20일 평균) — lookahead bias 있음 */
function volumeSurgeUniverse(
  threshold: number,
  avgDays: number = 20
): Map<string, Set<string>> {
  const universe = new Map<string, Set<string>>();

  for (const date of allDates) {
    const surged = new Set<string>();

    for (const code of stockCodes) {
      const candles = stockCandles.get(code)!;
      const todayIdx = candles.findIndex((c) => c.date === date);
      if (todayIdx < avgDays) continue;

      const todayVolume = candles[todayIdx]!.volume;

      // 최근 avgDays일 평균 거래량 (당일 제외)
      let totalVol = 0;
      let count = 0;
      for (let j = todayIdx - avgDays; j < todayIdx; j++) {
        const vol = candles[j]?.volume ?? 0;
        if (vol > 0) {
          totalVol += vol;
          count++;
        }
      }
      if (count === 0) continue;
      const avgVol = totalVol / count;

      if (avgVol > 0 && todayVolume > threshold * avgVol) {
        surged.add(code);
      }
    }

    universe.set(date, surged);
  }

  return universe;
}

/** ★ 전일 거래량 급증 종목 (전일 거래량 > threshold × 20일 평균) — lookahead bias 없음 */
function prevDaySurgeUniverse(
  threshold: number,
  avgDays: number = 20
): Map<string, Set<string>> {
  const universe = new Map<string, Set<string>>();

  for (let di = 1; di < allDates.length; di++) {
    const date = allDates[di]!; // 오늘 (매매일)
    const surged = new Set<string>();

    for (const code of stockCodes) {
      const candles = stockCandles.get(code)!;
      const todayIdx = candles.findIndex((c) => c.date === date);
      if (todayIdx < avgDays + 1) continue;

      // 전일 거래량
      const prevVolume = candles[todayIdx - 1]!.volume;

      // 전일 기준 과거 avgDays일 평균 거래량 (전일 제외)
      let totalVol = 0;
      let count = 0;
      for (let j = todayIdx - 1 - avgDays; j < todayIdx - 1; j++) {
        const vol = candles[j]?.volume ?? 0;
        if (vol > 0) {
          totalVol += vol;
          count++;
        }
      }
      if (count === 0) continue;
      const avgVol = totalVol / count;

      if (avgVol > 0 && prevVolume > threshold * avgVol) {
        surged.add(code);
      }
    }

    universe.set(date, surged);
  }

  return universe;
}

/** ★ 최근 N일 내 거래량 급증 이력 (N일 중 하루라도 급증했으면 포함) — lookahead bias 없음 */
function recentSurgeUniverse(
  threshold: number,
  withinDays: number = 3,
  avgDays: number = 20
): Map<string, Set<string>> {
  const universe = new Map<string, Set<string>>();

  for (let di = 0; di < allDates.length; di++) {
    const date = allDates[di]!;
    const surged = new Set<string>();

    for (const code of stockCodes) {
      const candles = stockCandles.get(code)!;
      const todayIdx = candles.findIndex((c) => c.date === date);
      if (todayIdx < avgDays + withinDays) continue;

      // 최근 withinDays일 중 하루라도 급증했는지 확인 (당일 제외, 전일~N일전)
      let hadSurge = false;
      for (let d = 1; d <= withinDays; d++) {
        const checkIdx = todayIdx - d;
        if (checkIdx < avgDays) continue;
        const checkVol = candles[checkIdx]!.volume;

        let totalVol = 0;
        let count = 0;
        for (let j = checkIdx - avgDays; j < checkIdx; j++) {
          const vol = candles[j]?.volume ?? 0;
          if (vol > 0) {
            totalVol += vol;
            count++;
          }
        }
        if (count === 0) continue;
        const avgVol = totalVol / count;
        if (avgVol > 0 && checkVol > threshold * avgVol) {
          hadSurge = true;
          break;
        }
      }

      if (hadSurge) surged.add(code);
    }

    universe.set(date, surged);
  }

  return universe;
}

/** 두 유니버스 합집합 */
function unionUniverse(
  a: Map<string, Set<string>>,
  b: Map<string, Set<string>>
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  for (const date of allKeys) {
    const aSet = a.get(date) ?? new Set();
    const bSet = b.get(date) ?? new Set();
    result.set(date, new Set([...aSet, ...bSet]));
  }
  return result;
}

// ══════════════════════════════════════════
// MA + Turtle 신호 생성 (유니버스 필터 적용)
// ══════════════════════════════════════════

interface SignalPair {
  buy: Map<string, Set<string>>;
  sell: Map<string, Set<string>>;
}

function generateMATurtleSignals(
  shortMa: number,
  longMa: number,
  entryPeriod: number,
  exitPeriod: number,
  universe: Map<string, Set<string>> | null // null = 전체 종목
): SignalPair {
  const buySignals = new Map<string, Set<string>>();
  const sellSignals = new Map<string, Set<string>>();

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    const minLen = Math.max(longMa, entryPeriod, exitPeriod) + 2;
    if (candles.length < minLen) continue;

    const sm = sma(candles, shortMa);
    const lm = sma(candles, longMa);
    const dcEntry = donchianChannel(candles, entryPeriod);
    const dcExit = donchianChannel(candles, exitPeriod);

    for (let i = 1; i < candles.length; i++) {
      const date = candles[i]!.date;
      const s = sm[i],
        l = lm[i],
        ps = sm[i - 1],
        pl = lm[i - 1];
      const prevUpper = dcEntry.upper[i - 1];
      const exitLower = dcExit.lower[i];

      if (s == null || l == null || ps == null || pl == null) continue;

      // 매수: 골든크로스 + Turtle 돌파 (교집합)
      if (prevUpper != null) {
        const goldenCross = ps <= pl && s > l;
        const turtleBreak = candles[i]!.high > prevUpper;

        if (goldenCross && turtleBreak) {
          // 유니버스 필터 적용
          if (universe === null || universe.get(date)?.has(code)) {
            if (!buySignals.has(date)) buySignals.set(date, new Set());
            buySignals.get(date)!.add(code);
          }
        }
      }

      // 매도: 데드크로스 OR Donchian 하한 이탈
      if (ps != null && pl != null && ps >= pl && s < l) {
        if (!sellSignals.has(date)) sellSignals.set(date, new Set());
        sellSignals.get(date)!.add(code);
      }
      if (
        exitLower != null &&
        (candles[i]!.adjClose ?? candles[i]!.close) < exitLower
      ) {
        if (!sellSignals.has(date)) sellSignals.set(date, new Set());
        sellSignals.get(date)!.add(code);
      }
    }
  }

  return { buy: buySignals, sell: sellSignals };
}

// ══════════════════════════════════════════
// 포트폴리오 시뮬레이션
// ══════════════════════════════════════════

interface Position {
  stockCode: string;
  buyDateIdx: number;
  buyPrice: number;
  quantity: number;
  cost: number;
}

interface Result {
  name: string;
  totalReturn: number;
  cagr: number;
  mdd: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  totalTrades: number;
  avgReturn: number;
  avgUniverseSize: number;
}

function simulate(
  label: string,
  signals: SignalPair,
  sl: number,
  tp: number,
  maxHold: number,
  maxPositions: number,
  universe: Map<string, Set<string>> | null
): Result {
  let cash = INITIAL_CAPITAL;
  const positions = new Map<string, Position>();
  const trades: { pnl: number; pnlRate: number }[] = [];
  const equityCurve: number[] = [];
  let peak = INITIAL_CAPITAL;
  let maxDD = 0;

  for (let di = 0; di < allDates.length; di++) {
    const date = allDates[di]!;

    // 매도
    for (const [code, pos] of [...positions.entries()]) {
      const candles = stockCandles.get(code)!;
      const todayIdx = candles.findIndex((c) => c.date === date);
      if (todayIdx < 0) continue;
      const today = candles[todayIdx]!;
      const holdDays = di - pos.buyDateIdx;

      let sell = false;
      let sellPrice = today.open;

      if (sl < 0 && today.low <= pos.buyPrice * (1 + sl)) {
        sellPrice = Math.max(today.open, pos.buyPrice * (1 + sl));
        sell = true;
      } else if (tp > 0 && today.high >= pos.buyPrice * (1 + tp)) {
        sellPrice = pos.buyPrice * (1 + tp);
        sell = true;
      } else if (signals.sell.get(date)?.has(code)) {
        sellPrice = today.open;
        sell = true;
      } else if (maxHold > 0 && holdDays >= maxHold) {
        sellPrice = today.open;
        sell = true;
      }

      if (sell) {
        const sp = sellPrice * (1 - SLIPPAGE);
        const amount = sp * pos.quantity;
        const net = amount - amount * FEE_RATE - amount * TAX_RATE;
        const pnl = net - pos.cost;
        trades.push({ pnl, pnlRate: pos.cost > 0 ? pnl / pos.cost : 0 });
        cash += net;
        positions.delete(code);
      }
    }

    // 매수
    const buyCandidates = signals.buy.get(date);
    if (buyCandidates && positions.size < maxPositions) {
      for (const code of buyCandidates) {
        if (positions.has(code) || positions.size >= maxPositions) continue;

        const candles = stockCandles.get(code)!;
        const todayIdx = candles.findIndex((c) => c.date === date);
        if (todayIdx < 0) continue;
        const today = candles[todayIdx]!;

        const totalEquity =
          cash +
          [...positions.values()].reduce((s, p) => {
            const pc = stockCandles.get(p.stockCode)!;
            const pi = pc.findIndex((c) => c.date === date);
            return (
              s +
              (pi >= 0 ? (pc[pi]!.adjClose ?? pc[pi]!.close) : p.buyPrice) *
                p.quantity
            );
          }, 0);
        const maxAmount = Math.min(totalEquity * 0.2, cash * 0.95);
        if (maxAmount < today.open * 2) continue;

        const buyPrice = today.open * (1 + SLIPPAGE);
        const quantity = Math.floor(maxAmount / buyPrice);
        if (quantity <= 0) continue;

        const amount = buyPrice * quantity;
        const fee = amount * FEE_RATE;
        const cost = amount + fee;
        if (cost > cash) continue;

        cash -= cost;
        positions.set(code, {
          stockCode: code,
          buyDateIdx: di,
          buyPrice,
          quantity,
          cost
        });
      }
    }

    // 에쿼티
    let stockValue = 0;
    for (const pos of positions.values()) {
      const candles = stockCandles.get(pos.stockCode)!;
      const tidx = candles.findIndex((c) => c.date === date);
      const price =
        tidx >= 0
          ? (candles[tidx]!.adjClose ?? candles[tidx]!.close)
          : pos.buyPrice;
      stockValue += price * pos.quantity;
    }
    const equity = cash + stockValue;
    equityCurve.push(equity);
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // 미청산 강제 청산
  for (const [, pos] of positions) {
    const candles = stockCandles.get(pos.stockCode)!;
    const last = candles[candles.length - 1];
    const sellPrice =
      (last ? (last.adjClose ?? last.close) : pos.buyPrice) * (1 - SLIPPAGE);
    const amount = sellPrice * pos.quantity;
    const net = amount - amount * FEE_RATE - amount * TAX_RATE;
    trades.push({
      pnl: net - pos.cost,
      pnlRate: pos.cost > 0 ? (net - pos.cost) / pos.cost : 0
    });
    cash += net;
  }

  const finalEquity = cash;
  const totalReturn = (finalEquity - INITIAL_CAPITAL) / INITIAL_CAPITAL;
  const years = allDates.length / 252;
  const cagr =
    years > 0
      ? Math.pow(Math.max(finalEquity, 0) / INITIAL_CAPITAL, 1 / years) - 1
      : 0;

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const totalProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor =
    totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99 : 0;

  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1]!;
    if (prev > 0) dailyReturns.push((equityCurve[i]! - prev) / prev);
  }
  let sharpeRatio = 0;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) /
      (dailyReturns.length - 1);
    sharpeRatio =
      variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;
  }

  const avgReturn =
    trades.length > 0
      ? trades.reduce((s, t) => s + t.pnlRate, 0) / trades.length
      : 0;

  // 평균 유니버스 크기
  let avgUniverseSize = stockCodes.length;
  if (universe) {
    let total = 0;
    let count = 0;
    for (const [, set] of universe) {
      total += set.size;
      count++;
    }
    avgUniverseSize = count > 0 ? total / count : 0;
  }

  return {
    name: label,
    totalReturn,
    cagr,
    mdd: maxDD,
    winRate,
    profitFactor,
    sharpeRatio,
    totalTrades: trades.length,
    avgReturn,
    avgUniverseSize
  };
}

// ══════════════════════════════════════════
// 실행
// ══════════════════════════════════════════

console.log('유니버스 필터 생성 중...');

// 평균 유니버스 크기 확인
function avgSize(u: Map<string, Set<string>>): string {
  let total = 0,
    count = 0;
  for (const [, set] of u) {
    total += set.size;
    count++;
  }
  return (count > 0 ? total / count : 0).toFixed(1);
}

// 기존 (lookahead bias 있음)
const surge3x_today = volumeSurgeUniverse(3.0);

// ★ 실전 적용 가능한 필터 (전일 기준 — lookahead bias 없음)
const prevSurge2x = prevDaySurgeUniverse(2.0);
const prevSurge3x = prevDaySurgeUniverse(3.0);
const recent3d_2x = recentSurgeUniverse(2.0, 3); // 최근 3일 내 2x 급증 이력
const recent3d_3x = recentSurgeUniverse(3.0, 3); // 최근 3일 내 3x 급증 이력
const recent5d_2x = recentSurgeUniverse(2.0, 5); // 최근 5일 내 2x 급증 이력
const recent5d_3x = recentSurgeUniverse(3.0, 5); // 최근 5일 내 3x 급증 이력

// 거래대금 Top
const top50 = topAmountUniverse(50);
const top100 = topAmountUniverse(100);

// 합집합
const top50PlusPrevSurge3x = unionUniverse(top50, prevSurge3x);
const top100PlusRecent3d_3x = unionUniverse(top100, recent3d_3x);

console.log(
  `  [lookahead] 당일 급증 3x: 평균 ${avgSize(surge3x_today)}종목/일`
);
console.log(`  ★ 전일 급증 2x: 평균 ${avgSize(prevSurge2x)}종목/일`);
console.log(`  ★ 전일 급증 3x: 평균 ${avgSize(prevSurge3x)}종목/일`);
console.log(`  ★ 최근3일 급증 2x: 평균 ${avgSize(recent3d_2x)}종목/일`);
console.log(`  ★ 최근3일 급증 3x: 평균 ${avgSize(recent3d_3x)}종목/일`);
console.log(`  ★ 최근5일 급증 2x: 평균 ${avgSize(recent5d_2x)}종목/일`);
console.log(`  ★ 최근5일 급증 3x: 평균 ${avgSize(recent5d_3x)}종목/일`);
console.log(`  거래대금 Top50: 평균 ${avgSize(top50)}종목/일`);
console.log(`  거래대금 Top100: 평균 ${avgSize(top100)}종목/일`);
console.log(
  `  Top50 + 전일급증3x: 평균 ${avgSize(top50PlusPrevSurge3x)}종목/일`
);
console.log(
  `  Top100 + 최근3일3x: 평균 ${avgSize(top100PlusRecent3d_3x)}종목/일`
);
console.log();

type UniverseConfig = {
  label: string;
  universe: Map<string, Set<string>> | null;
};

const universes: UniverseConfig[] = [
  { label: '전체 종목', universe: null },
  { label: '[LA] 당일급증3x', universe: surge3x_today },
  { label: '★ 전일 급증 2x', universe: prevSurge2x },
  { label: '★ 전일 급증 3x', universe: prevSurge3x },
  { label: '★ 최근3일 급증2x', universe: recent3d_2x },
  { label: '★ 최근3일 급증3x', universe: recent3d_3x },
  { label: '★ 최근5일 급증2x', universe: recent5d_2x },
  { label: '★ 최근5일 급증3x', universe: recent5d_3x },
  { label: '거래대금 Top50', universe: top50 },
  { label: '거래대금 Top100', universe: top100 },
  { label: 'Top50+전일3x', universe: top50PlusPrevSurge3x },
  { label: 'Top100+최근3일3x', universe: top100PlusRecent3d_3x }
];

// ── 전략 A: MA10/50 + Turtle40/20, sl=-5%, hold=10d ──
console.log('═'.repeat(80));
console.log('전략 A (공격형): MA10/50 + Turtle40/20, sl=-5%, hold=10d');
console.log('═'.repeat(80));

const resultsA: Result[] = [];
for (const { label, universe } of universes) {
  process.stdout.write(`  ${label}... `);
  const signals = generateMATurtleSignals(10, 50, 40, 20, universe);
  const result = simulate(label, signals, -0.05, 0, 10, 10, universe);
  resultsA.push(result);
  console.log('done');
}

console.log();
console.log(
  '| 유니버스 | 평균종목수 | 수익률 | CAGR | MDD | 승률 | PF | Sharpe | 거래수 | 평균수익 |'
);
console.log(
  '|----------|-----------|--------|------|-----|------|------|--------|--------|---------|'
);
for (const r of resultsA) {
  console.log(
    `| ${r.name.padEnd(16)} | ${r.avgUniverseSize.toFixed(0).padStart(5)} | ${(r.totalReturn * 100).toFixed(0)}% | ${(r.cagr * 100).toFixed(0)}% | ${(r.mdd * 100).toFixed(1)}% | ${(r.winRate * 100).toFixed(0)}% | ${r.profitFactor.toFixed(2)} | ${r.sharpeRatio.toFixed(2)} | ${String(r.totalTrades).padStart(4)} | ${(r.avgReturn * 100).toFixed(1)}% |`
  );
}

// ── 전략 B: MA5/20 + Turtle20/10, sl=-5%, tp=5%, hold=10d ──
console.log();
console.log('═'.repeat(80));
console.log('전략 B (안정형): MA5/20 + Turtle20/10, sl=-5%, tp=5%, hold=10d');
console.log('═'.repeat(80));

const resultsB: Result[] = [];
for (const { label, universe } of universes) {
  process.stdout.write(`  ${label}... `);
  const signals = generateMATurtleSignals(5, 20, 20, 10, universe);
  const result = simulate(label, signals, -0.05, 0.05, 10, 10, universe);
  resultsB.push(result);
  console.log('done');
}

console.log();
console.log(
  '| 유니버스 | 평균종목수 | 수익률 | CAGR | MDD | 승률 | PF | Sharpe | 거래수 | 평균수익 |'
);
console.log(
  '|----------|-----------|--------|------|-----|------|------|--------|--------|---------|'
);
for (const r of resultsB) {
  console.log(
    `| ${r.name.padEnd(16)} | ${r.avgUniverseSize.toFixed(0).padStart(5)} | ${(r.totalReturn * 100).toFixed(0)}% | ${(r.cagr * 100).toFixed(0)}% | ${(r.mdd * 100).toFixed(1)}% | ${(r.winRate * 100).toFixed(0)}% | ${r.profitFactor.toFixed(2)} | ${r.sharpeRatio.toFixed(2)} | ${String(r.totalTrades).padStart(4)} | ${(r.avgReturn * 100).toFixed(1)}% |`
  );
}

console.log();
console.log('═'.repeat(80));
console.log('결론 요약');
console.log('═'.repeat(80));

// 전략 A 최고
const bestA = resultsA.reduce((best, r) =>
  r.totalReturn > best.totalReturn ? r : best
);
const worstA = resultsA.reduce((worst, r) =>
  r.totalReturn < worst.totalReturn ? r : worst
);
console.log(
  `전략 A 최고: ${bestA.name} (${(bestA.totalReturn * 100).toFixed(0)}%)`
);
console.log(
  `전략 A 최저: ${worstA.name} (${(worstA.totalReturn * 100).toFixed(0)}%)`
);

const bestB = resultsB.reduce((best, r) =>
  r.totalReturn > best.totalReturn ? r : best
);
const worstB = resultsB.reduce((worst, r) =>
  r.totalReturn < worst.totalReturn ? r : worst
);
console.log(
  `전략 B 최고: ${bestB.name} (${(bestB.totalReturn * 100).toFixed(0)}%)`
);
console.log(
  `전략 B 최저: ${worstB.name} (${(worstB.totalReturn * 100).toFixed(0)}%)`
);

// Sharpe 기준
const bestSharpeA = resultsA.reduce((best, r) =>
  r.sharpeRatio > best.sharpeRatio ? r : best
);
const bestSharpeB = resultsB.reduce((best, r) =>
  r.sharpeRatio > best.sharpeRatio ? r : best
);
console.log(`\nSharpe 기준:`);
console.log(
  `전략 A: ${bestSharpeA.name} (Sharpe ${bestSharpeA.sharpeRatio.toFixed(2)})`
);
console.log(
  `전략 B: ${bestSharpeB.name} (Sharpe ${bestSharpeB.sharpeRatio.toFixed(2)})`
);

db.close();
