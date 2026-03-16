/**
 * MA+Turtle 교집합 전략: hold=9 vs hold=10 비교
 *
 * 전략 A: MA10/50 ∩ Turtle40/20, sl=-5%, tp=X
 * 전략 B: MA5/20 ∩ Turtle20/10, sl=-5%, tp=5%
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

const SLIPPAGE = 0.001;
const FEE_RATE = 0.00015;
const TAX_RATE = 0.0018;
const INITIAL_CAPITAL = 10_000_000;

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

console.log(`=== MA+Turtle 교집합: hold=9 vs hold=10 비교 ===`);
console.log(`종목: ${stockCodes.length}개, 거래일: ${allDates.length}일`);
console.log(`기간: ${allDates[0]} ~ ${allDates[allDates.length - 1]}\n`);

const stockCandles = new Map<string, Candle[]>();
for (const code of stockCodes) {
  const candles = db
    .prepare(
      `SELECT stock_code AS stockCode, date, open, high, low, close, adj_close AS adjClose, volume, amount
     FROM daily_candles WHERE stock_code = ? ORDER BY date ASC`
    )
    .all(code) as Candle[];
  stockCandles.set(code, candles);
}

interface Position {
  stockCode: string;
  buyDateIdx: number;
  buyPrice: number;
  quantity: number;
  cost: number;
}

function simulatePortfolio(
  buySignals: Map<string, Set<string>>,
  sellSignals: Map<string, Set<string>>,
  stopLossRate: number,
  takeProfitRate: number,
  maxHoldDays: number,
  maxPositions: number,
  maxWeight: number
) {
  let cash = INITIAL_CAPITAL;
  const positions = new Map<string, Position>();
  const trades: { pnl: number; pnlRate: number; holdDays: number }[] = [];
  const equityCurve: number[] = [];
  let peak = INITIAL_CAPITAL;
  let maxDD = 0;

  for (let di = 0; di < allDates.length; di++) {
    const date = allDates[di]!;

    for (const [code, pos] of [...positions.entries()]) {
      const candles = stockCandles.get(code)!;
      const todayIdx = candles.findIndex((c) => c.date === date);
      if (todayIdx < 0) continue;
      const today = candles[todayIdx]!;
      const holdDays = di - pos.buyDateIdx;

      let sell = false;
      let sellPrice = today.open;

      if (stopLossRate < 0 && today.low <= pos.buyPrice * (1 + stopLossRate)) {
        sellPrice = Math.max(today.open, pos.buyPrice * (1 + stopLossRate));
        sell = true;
      } else if (
        takeProfitRate > 0 &&
        today.high >= pos.buyPrice * (1 + takeProfitRate)
      ) {
        sellPrice = pos.buyPrice * (1 + takeProfitRate);
        sell = true;
      } else if (sellSignals.get(date)?.has(code)) {
        sellPrice = today.open;
        sell = true;
      } else if (maxHoldDays > 0 && holdDays >= maxHoldDays) {
        sellPrice = today.open;
        sell = true;
      }

      if (sell) {
        const sp = sellPrice * (1 - SLIPPAGE);
        const amount = sp * pos.quantity;
        const fee = amount * FEE_RATE;
        const tax = amount * TAX_RATE;
        const net = amount - fee - tax;
        const pnl = net - pos.cost;
        trades.push({
          pnl,
          pnlRate: pos.cost > 0 ? pnl / pos.cost : 0,
          holdDays
        });
        cash += net;
        positions.delete(code);
      }
    }

    const buyCandidates = buySignals.get(date);
    if (buyCandidates && positions.size < maxPositions) {
      for (const code of buyCandidates) {
        if (positions.has(code)) continue;
        if (positions.size >= maxPositions) break;

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
        const maxAmount = Math.min(totalEquity * maxWeight, cash * 0.95);
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
  for (const [code, pos] of positions) {
    const candles = stockCandles.get(code)!;
    const last = candles[candles.length - 1];
    const sellPrice =
      (last ? (last.adjClose ?? last.close) : pos.buyPrice) * (1 - SLIPPAGE);
    const amount = sellPrice * pos.quantity;
    const fee = amount * FEE_RATE;
    const tax = amount * TAX_RATE;
    const net = amount - fee - tax;
    const pnl = net - pos.cost;
    const holdDays = allDates.length - pos.buyDateIdx;
    trades.push({ pnl, pnlRate: pos.cost > 0 ? pnl / pos.cost : 0, holdDays });
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

  const avgHoldDays =
    trades.length > 0
      ? trades.reduce((s, t) => s + t.holdDays, 0) / trades.length
      : 0;
  const avgWinPnl =
    wins.length > 0 ? wins.reduce((s, t) => s + t.pnlRate, 0) / wins.length : 0;
  const avgLossPnl =
    losses.length > 0
      ? losses.reduce((s, t) => s + t.pnlRate, 0) / losses.length
      : 0;

  return {
    totalReturn,
    cagr,
    mdd: maxDD,
    winRate,
    profitFactor,
    sharpeRatio,
    totalTrades: trades.length,
    avgHoldDays,
    avgWinPnl,
    avgLossPnl
  };
}

// ── 시그널 생성 ──

function generateMACrossoverSignals(shortP: number, longP: number) {
  const buySignals = new Map<string, Set<string>>();
  const sellSignals = new Map<string, Set<string>>();

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < longP + 2) continue;
    const shortMa = sma(candles, shortP);
    const longMa = sma(candles, longP);

    for (let i = 1; i < candles.length; i++) {
      const sm = shortMa[i],
        lm = longMa[i],
        psm = shortMa[i - 1],
        plm = longMa[i - 1];
      if (sm == null || lm == null || psm == null || plm == null) continue;
      const date = candles[i]!.date;
      if (psm <= plm && sm > lm) {
        if (!buySignals.has(date)) buySignals.set(date, new Set());
        buySignals.get(date)!.add(code);
      }
      if (psm >= plm && sm < lm) {
        if (!sellSignals.has(date)) sellSignals.set(date, new Set());
        sellSignals.get(date)!.add(code);
      }
    }
  }
  return { buy: buySignals, sell: sellSignals };
}

function generateTurtleSignals(entryP: number, exitP: number) {
  const buySignals = new Map<string, Set<string>>();
  const sellSignals = new Map<string, Set<string>>();

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < Math.max(entryP, exitP) + 2) continue;
    const dc = donchianChannel(candles, entryP);
    const exitDc = donchianChannel(candles, exitP);

    for (let i = 1; i < candles.length; i++) {
      const prevUpper = dc.upper[i - 1];
      const exitLower = exitDc.lower[i];
      const close = candles[i]!.adjClose ?? candles[i]!.close;
      const high = candles[i]!.high;
      if (prevUpper == null) continue;
      const date = candles[i]!.date;

      if (high > prevUpper) {
        if (!buySignals.has(date)) buySignals.set(date, new Set());
        buySignals.get(date)!.add(code);
      }
      if (exitLower != null && close < exitLower) {
        if (!sellSignals.has(date)) sellSignals.set(date, new Set());
        sellSignals.get(date)!.add(code);
      }
    }
  }
  return { buy: buySignals, sell: sellSignals };
}

function intersectSignals(
  a: Map<string, Set<string>>,
  b: Map<string, Set<string>>
) {
  const result = new Map<string, Set<string>>();
  for (const [date, aSet] of a) {
    const bSet = b.get(date);
    if (!bSet) continue;
    const intersection = new Set<string>();
    for (const code of aSet) {
      if (bSet.has(code)) intersection.add(code);
    }
    if (intersection.size > 0) result.set(date, intersection);
  }
  return result;
}

function unionSignals(
  a: Map<string, Set<string>>,
  b: Map<string, Set<string>>
) {
  const result = new Map<string, Set<string>>();
  for (const date of new Set([...a.keys(), ...b.keys()])) {
    const merged = new Set<string>();
    a.get(date)?.forEach((c) => merged.add(c));
    b.get(date)?.forEach((c) => merged.add(c));
    result.set(date, merged);
  }
  return result;
}

// ── 시그널 생성 ──

console.log('시그널 생성중...');

const maSignals10_50 = generateMACrossoverSignals(10, 50);
const maSignals5_20 = generateMACrossoverSignals(5, 20);
const turtleSignals40_20 = generateTurtleSignals(40, 20);
const turtleSignals20_10 = generateTurtleSignals(20, 10);

// 전략 A: MA10/50 ∩ Turtle40/20
const stratABuy = intersectSignals(maSignals10_50.buy, turtleSignals40_20.buy);
const stratASell = unionSignals(maSignals10_50.sell, turtleSignals40_20.sell);

// 전략 B: MA5/20 ∩ Turtle20/10
const stratBBuy = intersectSignals(maSignals5_20.buy, turtleSignals20_10.buy);
const stratBSell = unionSignals(maSignals5_20.sell, turtleSignals20_10.sell);

// ── 공통 출력 함수 ──

function printHeader(title: string) {
  console.log(`\n${'═'.repeat(110)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(110)}`);
  console.log(
    'tp'.padStart(6),
    'hold'.padStart(5),
    '| 수익률'.padEnd(11),
    '| CAGR'.padEnd(10),
    '| MDD'.padEnd(9),
    '| 승률'.padEnd(8),
    '| PF'.padEnd(8),
    '| Sharpe'.padEnd(9),
    '| 거래'.padEnd(6),
    '| 평균보유'.padEnd(9),
    '| 평균수익'.padEnd(10),
    '| 평균손실'.padEnd(10)
  );
  console.log('─'.repeat(110));
}

function printRow(
  tp: number,
  hd: number,
  r: ReturnType<typeof simulatePortfolio>
) {
  const tpLabel = tp === 0 ? 'X' : `${(tp * 100).toFixed(0)}%`;
  console.log(
    tpLabel.padStart(6),
    `${hd}d`.padStart(5),
    `| ${(r.totalReturn * 100).toFixed(1)}%`.padEnd(11),
    `| ${(r.cagr * 100).toFixed(1)}%`.padEnd(10),
    `| ${(r.mdd * 100).toFixed(1)}%`.padEnd(9),
    `| ${(r.winRate * 100).toFixed(1)}%`.padEnd(8),
    `| ${r.profitFactor.toFixed(2)}`.padEnd(8),
    `| ${r.sharpeRatio.toFixed(2)}`.padEnd(9),
    `| ${r.totalTrades}`.padEnd(6),
    `| ${r.avgHoldDays.toFixed(1)}d`.padEnd(9),
    `| ${(r.avgWinPnl * 100).toFixed(2)}%`.padEnd(10),
    `| ${(r.avgLossPnl * 100).toFixed(2)}%`.padEnd(10)
  );
}

// ── 전략 A: 익절 + 보유일 그리드 ──

const tpOptionsA = [0, 0.03, 0.05, 0.07, 0.1, 0.15, 0.2, 0.3];
const holdOptionsA = [8, 10, 12, 15];

printHeader(
  '전략 A (공격형): MA10/50 ∩ Turtle40/20, sl=-5% — 익절 × 보유일 그리드'
);

for (const tp of tpOptionsA) {
  for (const hd of holdOptionsA) {
    const r = simulatePortfolio(stratABuy, stratASell, -0.05, tp, hd, 10, 0.2);
    printRow(tp, hd, r);
  }
  console.log('─'.repeat(110));
}

// ── 전략 B: 익절 + 보유일 그리드 ──

const tpOptionsB = [0, 0.03, 0.04, 0.05, 0.06, 0.07, 0.1];
const holdOptionsB = [7, 8, 10, 12];

printHeader(
  '전략 B (안정형): MA5/20 ∩ Turtle20/10, sl=-5% — 익절 × 보유일 그리드'
);

for (const tp of tpOptionsB) {
  for (const hd of holdOptionsB) {
    const r = simulatePortfolio(stratBBuy, stratBSell, -0.05, tp, hd, 10, 0.2);
    printRow(tp, hd, r);
  }
  console.log('─'.repeat(110));
}

db.close();
console.log('\n완료.');
