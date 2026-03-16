/**
 * 시장 레짐(상승/하락)별 전략 성과 분석
 *
 * 상위 전략들을 BULL/BEAR 구간별로 나눠서 성과를 비교한다.
 * breadth (20일 SMA 위 종목 비율) 기준으로 레짐 판단.
 *
 * 사용법:
 *   pnpm --filter @trading/engine tsx src/scripts/analyze-regime.ts
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import Database from 'better-sqlite3';
import {
  sma,
  rsi,
  atr,
  bollingerBands,
  donchianChannel
} from '../strategy/indicators.js';
import type { Candle } from '@trading/shared/types';

const DB_PATH =
  process.env['DB_PATH'] || path.resolve(__dirname, '../../data/trading.db');
const db = new Database(DB_PATH, { readonly: true });

const SLIPPAGE = 0.001;
const FEE_RATE = 0.00015;
const TAX_RATE = 0.0018;
const INITIAL_CAPITAL = 10_000_000;
const MA_PERIOD_FOR_REGIME = 20;
const BULL_THRESHOLD = 0.5;
const BEAR_THRESHOLD = 0.4;

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

console.log(`=== 시장 레짐별 전략 성과 분석 ===`);
console.log(`종목: ${stockCodes.length}개, 거래일: ${allDates.length}일`);
console.log(`기간: ${allDates[0]} ~ ${allDates[allDates.length - 1]}\n`);

// 종목별 일봉 로드
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

const dateIndexMap = new Map<string, number>();
allDates.forEach((d, i) => dateIndexMap.set(d, i));

// ── Breadth 계산 (일별 시장 레짐) ──
type Regime = 'BULL' | 'BEAR' | 'NEUTRAL';

const dailyBreadth = new Map<string, number>();
const dailyRegime = new Map<string, Regime>();

for (const date of allDates) {
  let above = 0,
    total = 0;
  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    const idx = candles.findIndex((c) => c.date === date);
    if (idx < MA_PERIOD_FOR_REGIME) continue;
    let sum = 0;
    for (let j = idx - MA_PERIOD_FOR_REGIME + 1; j <= idx; j++)
      sum += candles[j]!.adjClose ?? candles[j]!.close;
    const ma20 = sum / MA_PERIOD_FOR_REGIME;
    total++;
    if ((candles[idx]!.adjClose ?? candles[idx]!.close) > ma20) above++;
  }
  const breadth = total > 0 ? above / total : 0;
  dailyBreadth.set(date, breadth);

  let regime: Regime;
  if (breadth >= BULL_THRESHOLD) regime = 'BULL';
  else if (breadth < BEAR_THRESHOLD) regime = 'BEAR';
  else regime = 'NEUTRAL';
  dailyRegime.set(date, regime);
}

// ── 레짐 분포 출력 ──
let bullDays = 0,
  bearDays = 0,
  neutralDays = 0;
const regimeChanges: { date: string; regime: Regime; breadth: number }[] = [];
let prevRegime: Regime | null = null;

for (const date of allDates) {
  const r = dailyRegime.get(date)!;
  if (r === 'BULL') bullDays++;
  else if (r === 'BEAR') bearDays++;
  else neutralDays++;
  if (r !== prevRegime) {
    regimeChanges.push({ date, regime: r, breadth: dailyBreadth.get(date)! });
    prevRegime = r;
  }
}

console.log(`레짐 분포:`);
console.log(
  `  BULL  (breadth≥50%): ${bullDays}일 (${((bullDays / allDates.length) * 100).toFixed(1)}%)`
);
console.log(
  `  BEAR  (breadth<40%): ${bearDays}일 (${((bearDays / allDates.length) * 100).toFixed(1)}%)`
);
console.log(
  `  NEUTRAL (40~50%) : ${neutralDays}일 (${((neutralDays / allDates.length) * 100).toFixed(1)}%)`
);

console.log(`\n레짐 전환 이력:`);
for (const { date, regime, breadth } of regimeChanges) {
  console.log(
    `  ${date}  ${regime.padEnd(7)} breadth=${(breadth * 100).toFixed(1)}%`
  );
}

// ── 포트폴리오 시뮬레이션 (레짐 필터 포함) ──

interface Position {
  stockCode: string;
  buyDate: string;
  buyDateIdx: number;
  buyPrice: number;
  quantity: number;
  cost: number;
}

interface SimResult {
  totalReturn: number;
  cagr: number;
  mdd: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  totalTrades: number;
  avgHoldDays: number;
  avgPnlRate: number;
}

function simulatePortfolio(
  buySignals: Map<string, Set<string>>,
  sellSignals: Map<string, Set<string>>,
  stopLossRate: number,
  takeProfitRate: number,
  maxHoldDays: number,
  maxPositions: number,
  maxWeight: number,
  regimeFilter: Regime | 'ALL'
): SimResult {
  let cash = INITIAL_CAPITAL;
  const positions = new Map<string, Position>();
  const trades: { pnl: number; pnlRate: number; holdDays: number }[] = [];
  const equityCurve: number[] = [];
  let peak = INITIAL_CAPITAL;
  let maxDD = 0;

  for (let di = 0; di < allDates.length; di++) {
    const date = allDates[di]!;
    const regime = dailyRegime.get(date)!;

    // 매도 (레짐 무관 — 보유 중이면 매도 조건 체크)
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
        const pnlRate = pos.cost > 0 ? pnl / pos.cost : 0;
        trades.push({ pnl, pnlRate, holdDays });
        cash += net;
        positions.delete(code);
      }
    }

    // 매수 (레짐 필터 적용)
    const allowBuy = regimeFilter === 'ALL' || regime === regimeFilter;
    const buyCandidates = buySignals.get(date);
    if (allowBuy && buyCandidates && positions.size < maxPositions) {
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
          buyDate: date,
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
  for (const [code, pos] of positions) {
    const candles = stockCandles.get(code)!;
    const last = candles[candles.length - 1];
    const sellPrice =
      (last ? (last.adjClose ?? last.close) : pos.buyPrice) * (1 - SLIPPAGE);
    const amount = sellPrice * pos.quantity;
    const net = amount - amount * FEE_RATE - amount * TAX_RATE;
    const pnl = net - pos.cost;
    trades.push({
      pnl,
      pnlRate: pos.cost > 0 ? pnl / pos.cost : 0,
      holdDays: allDates.length - pos.buyDateIdx
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

  const avgHoldDays =
    trades.length > 0
      ? trades.reduce((s, t) => s + t.holdDays, 0) / trades.length
      : 0;
  const avgPnlRate =
    trades.length > 0
      ? trades.reduce((s, t) => s + t.pnlRate, 0) / trades.length
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
    avgPnlRate
  };
}

// ── 시그널 생성 함수들 ──

function generateMACrossoverSignals(
  shortP: number,
  longP: number
): { buy: Map<string, Set<string>>; sell: Map<string, Set<string>> } {
  const buy = new Map<string, Set<string>>();
  const sell = new Map<string, Set<string>>();
  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < longP + 2) continue;
    const sm = sma(candles, shortP);
    const lm = sma(candles, longP);
    for (let i = 1; i < candles.length; i++) {
      const s = sm[i],
        l = lm[i],
        ps = sm[i - 1],
        pl = lm[i - 1];
      if (s == null || l == null || ps == null || pl == null) continue;
      const date = candles[i]!.date;
      if (ps <= pl && s > l) {
        if (!buy.has(date)) buy.set(date, new Set());
        buy.get(date)!.add(code);
      }
      if (ps >= pl && s < l) {
        if (!sell.has(date)) sell.set(date, new Set());
        sell.get(date)!.add(code);
      }
    }
  }
  return { buy, sell };
}

function generateTurtleSignals(
  entryP: number,
  exitP: number
): { buy: Map<string, Set<string>>; sell: Map<string, Set<string>> } {
  const buy = new Map<string, Set<string>>();
  const sell = new Map<string, Set<string>>();
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
        if (!buy.has(date)) buy.set(date, new Set());
        buy.get(date)!.add(code);
      }
      if (exitLower != null && close < exitLower) {
        if (!sell.has(date)) sell.set(date, new Set());
        sell.get(date)!.add(code);
      }
    }
  }
  return { buy, sell };
}

function intersectSignals(
  a: Map<string, Set<string>>,
  b: Map<string, Set<string>>
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const [date, aSet] of a) {
    const bSet = b.get(date);
    if (!bSet) continue;
    const inter = new Set<string>();
    for (const c of aSet) {
      if (bSet.has(c)) inter.add(c);
    }
    if (inter.size > 0) result.set(date, inter);
  }
  return result;
}

function unionSignals(
  a: Map<string, Set<string>>,
  b: Map<string, Set<string>>
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const date of new Set([...a.keys(), ...b.keys()])) {
    const merged = new Set<string>();
    a.get(date)?.forEach((c) => merged.add(c));
    b.get(date)?.forEach((c) => merged.add(c));
    result.set(date, merged);
  }
  return result;
}

// ── 테스트할 전략들 ──

interface StrategyDef {
  name: string;
  params: string;
  buy: Map<string, Set<string>>;
  sell: Map<string, Set<string>>;
  sl: number;
  tp: number;
  maxHold: number;
  maxPos: number;
  maxWeight: number;
}

console.log('\n시그널 생성 중...');

const maSignals5_20 = generateMACrossoverSignals(5, 20);
const maSignals10_50 = generateMACrossoverSignals(10, 50);
const turtleSignals20_10 = generateTurtleSignals(20, 10);
const turtleSignals40_20 = generateTurtleSignals(40, 20);

const strategies: StrategyDef[] = [
  // 1순위: MA+터틀 교집합 (최고 수익률)
  {
    name: 'MA10/50+Turtle40/20',
    params: 'sl=-5% hold=10d',
    buy: intersectSignals(maSignals10_50.buy, turtleSignals40_20.buy),
    sell: unionSignals(maSignals10_50.sell, turtleSignals40_20.sell),
    sl: -0.05,
    tp: 0,
    maxHold: 10,
    maxPos: 10,
    maxWeight: 0.2
  },
  // 2순위: MA+터틀 교집합 (최고 Sharpe)
  {
    name: 'MA5/20+Turtle20/10',
    params: 'sl=-5% tp=5% hold=10d',
    buy: intersectSignals(maSignals5_20.buy, turtleSignals20_10.buy),
    sell: unionSignals(maSignals5_20.sell, turtleSignals20_10.sell),
    sl: -0.05,
    tp: 0.05,
    maxHold: 10,
    maxPos: 10,
    maxWeight: 0.2
  },
  // 터틀 단독
  {
    name: 'Turtle20/10',
    params: 'sl=-7% hold=10d',
    buy: turtleSignals20_10.buy,
    sell: turtleSignals20_10.sell,
    sl: -0.07,
    tp: 0,
    maxHold: 10,
    maxPos: 10,
    maxWeight: 0.2
  },
  // MA 단독
  {
    name: 'MA5/20',
    params: 'sl=-5% hold=10d',
    buy: maSignals5_20.buy,
    sell: maSignals5_20.sell,
    sl: -0.05,
    tp: 0,
    maxHold: 10,
    maxPos: 10,
    maxWeight: 0.2
  },
  // MA+터틀 sl=-7% (수익률 2위)
  {
    name: 'MA5/20+Turtle20/10',
    params: 'sl=-7% hold=10d',
    buy: intersectSignals(maSignals5_20.buy, turtleSignals20_10.buy),
    sell: unionSignals(maSignals5_20.sell, turtleSignals20_10.sell),
    sl: -0.07,
    tp: 0,
    maxHold: 10,
    maxPos: 10,
    maxWeight: 0.2
  }
];

// ── 레짐별 시뮬레이션 ──

console.log('\n시뮬레이션 실행 중...\n');

const regimes: (Regime | 'ALL')[] = ['ALL', 'BULL', 'BEAR', 'NEUTRAL'];

function printResult(r: SimResult): string {
  return `Ret=${(r.totalReturn * 100).toFixed(1).padStart(8)}% | MDD=${(r.mdd * 100).toFixed(1).padStart(5)}% | Win=${(r.winRate * 100).toFixed(1).padStart(5)}% | PF=${r.profitFactor.toFixed(2).padStart(5)} | Sharpe=${r.sharpeRatio.toFixed(2).padStart(5)} | ${String(r.totalTrades).padStart(4)}건 | avgPnl=${(r.avgPnlRate * 100).toFixed(2)}%`;
}

for (const strat of strategies) {
  console.log(`${'═'.repeat(130)}`);
  console.log(`전략: ${strat.name} | ${strat.params}`);
  console.log(`${'─'.repeat(130)}`);

  for (const regime of regimes) {
    const result = simulatePortfolio(
      strat.buy,
      strat.sell,
      strat.sl,
      strat.tp,
      strat.maxHold,
      strat.maxPos,
      strat.maxWeight,
      regime
    );

    const label =
      regime === 'ALL'
        ? '전체 기간'
        : regime === 'BULL'
          ? 'BULL  (상승장)'
          : regime === 'BEAR'
            ? 'BEAR  (하락장)'
            : 'NEUTRAL (횡보장)';
    console.log(`  ${label.padEnd(16)} | ${printResult(result)}`);
  }
  console.log();
}

// ── 레짐 적응형 전략 (상승장/하락장 다른 파라미터) ──

console.log(`${'═'.repeat(130)}`);
console.log(`레짐 적응형 조합 테스트`);
console.log(`${'═'.repeat(130)}\n`);

// 가설: 상승장에서는 터틀(추세), 하락장에서는 MA 크로스(단기 반등)
// 또는: 상승장에서만 진입, 하락장에서는 쉼

interface AdaptiveDef {
  name: string;
  bullBuy: Map<string, Set<string>>;
  bullSell: Map<string, Set<string>>;
  bearBuy: Map<string, Set<string>>;
  bearSell: Map<string, Set<string>>;
  sl: number;
  tp: number;
  maxHold: number;
}

const adaptiveStrategies: AdaptiveDef[] = [
  {
    name: 'BULL=MA+터틀 / BEAR=쉼',
    bullBuy: intersectSignals(maSignals10_50.buy, turtleSignals40_20.buy),
    bullSell: unionSignals(maSignals10_50.sell, turtleSignals40_20.sell),
    bearBuy: new Map(),
    bearSell: new Map(),
    sl: -0.05,
    tp: 0,
    maxHold: 10
  },
  {
    name: 'BULL=MA+터틀 / BEAR=MA단기(5/20)',
    bullBuy: intersectSignals(maSignals10_50.buy, turtleSignals40_20.buy),
    bullSell: unionSignals(maSignals10_50.sell, turtleSignals40_20.sell),
    bearBuy: maSignals5_20.buy,
    bearSell: maSignals5_20.sell,
    sl: -0.05,
    tp: 0,
    maxHold: 10
  },
  {
    name: 'BULL=터틀(40/20) / BEAR=쉼',
    bullBuy: turtleSignals40_20.buy,
    bullSell: turtleSignals40_20.sell,
    bearBuy: new Map(),
    bearSell: new Map(),
    sl: -0.07,
    tp: 0,
    maxHold: 10
  },
  {
    name: 'BULL=쉼 / BEAR=MA+터틀',
    bullBuy: new Map(),
    bullSell: new Map(),
    bearBuy: intersectSignals(maSignals5_20.buy, turtleSignals20_10.buy),
    bearSell: unionSignals(maSignals5_20.sell, turtleSignals20_10.sell),
    sl: -0.05,
    tp: 0,
    maxHold: 10
  },
  {
    name: 'BULL=MA+터틀(10/50∩40/20) / BEAR=MA+터틀(5/20∩20/10)',
    bullBuy: intersectSignals(maSignals10_50.buy, turtleSignals40_20.buy),
    bullSell: unionSignals(maSignals10_50.sell, turtleSignals40_20.sell),
    bearBuy: intersectSignals(maSignals5_20.buy, turtleSignals20_10.buy),
    bearSell: unionSignals(maSignals5_20.sell, turtleSignals20_10.sell),
    sl: -0.05,
    tp: 0,
    maxHold: 10
  }
];

function simulateAdaptive(def: AdaptiveDef): SimResult {
  // 레짐에 따라 시그널을 합침
  const combinedBuy = new Map<string, Set<string>>();
  const combinedSell = new Map<string, Set<string>>();

  for (const date of allDates) {
    const regime = dailyRegime.get(date)!;
    let buySet: Set<string> | undefined;
    let sellSet: Set<string> | undefined;

    if (regime === 'BULL') {
      buySet = def.bullBuy.get(date);
      sellSet = def.bullSell.get(date);
    } else if (regime === 'BEAR') {
      buySet = def.bearBuy.get(date);
      sellSet = def.bearSell.get(date);
    }
    // NEUTRAL: 매수 안 함 (매도는 기존 포지션 정리)

    if (buySet && buySet.size > 0) combinedBuy.set(date, buySet);
    // 매도는 레짐 무관하게 합침 (보유 중이면 어디서든 매도 가능)
    const allSells = new Set<string>();
    def.bullSell.get(date)?.forEach((c) => allSells.add(c));
    def.bearSell.get(date)?.forEach((c) => allSells.add(c));
    if (allSells.size > 0) combinedSell.set(date, allSells);
  }

  return simulatePortfolio(
    combinedBuy,
    combinedSell,
    def.sl,
    def.tp,
    def.maxHold,
    10,
    0.2,
    'ALL'
  );
}

for (const def of adaptiveStrategies) {
  const result = simulateAdaptive(def);
  console.log(`  ${def.name.padEnd(55)} | ${printResult(result)}`);
}

// ── 월별 수익률 분석 (1순위 전략) ──

console.log(`\n${'═'.repeat(130)}`);
console.log(`월별 수익률 분석 — MA10/50+Turtle40/20 sl=-5% hold=10d (전체)`);
console.log(`${'─'.repeat(130)}`);

// 간단 월별: 각 월의 시작/끝 에쿼티로 계산
{
  let cash = INITIAL_CAPITAL;
  const positions = new Map<string, Position>();
  const monthlyEquity: {
    month: string;
    startEq: number;
    endEq: number;
    regime: string;
  }[] = [];

  const bestBuy = intersectSignals(maSignals10_50.buy, turtleSignals40_20.buy);
  const bestSell = unionSignals(maSignals10_50.sell, turtleSignals40_20.sell);
  const sl = -0.05,
    maxHold = 10;

  let currentMonth = '';
  let monthStart = INITIAL_CAPITAL;
  let monthRegimes: Regime[] = [];

  for (let di = 0; di < allDates.length; di++) {
    const date = allDates[di]!;
    const month = date.slice(0, 7);
    const regime = dailyRegime.get(date)!;

    if (month !== currentMonth) {
      if (currentMonth) {
        let sv = 0;
        for (const pos of positions.values()) {
          const candles = stockCandles.get(pos.stockCode)!;
          const tidx = candles.findIndex((c) => c.date === allDates[di - 1]!);
          sv +=
            (tidx >= 0
              ? (candles[tidx]!.adjClose ?? candles[tidx]!.close)
              : pos.buyPrice) * pos.quantity;
        }
        const endEq = cash + sv;
        const bullCount = monthRegimes.filter((r) => r === 'BULL').length;
        const bearCount = monthRegimes.filter((r) => r === 'BEAR').length;
        const dominant =
          bullCount > bearCount
            ? 'BULL'
            : bearCount > bullCount
              ? 'BEAR'
              : 'NEUTRAL';
        monthlyEquity.push({
          month: currentMonth,
          startEq: monthStart,
          endEq,
          regime: dominant
        });
        monthStart = endEq;
      }
      currentMonth = month;
      monthRegimes = [];
    }
    monthRegimes.push(regime);

    // 매도
    for (const [code, pos] of [...positions.entries()]) {
      const candles = stockCandles.get(code)!;
      const tidx = candles.findIndex((c) => c.date === date);
      if (tidx < 0) continue;
      const today = candles[tidx]!;
      const holdDays = di - pos.buyDateIdx;
      let sell = false,
        sellPrice = today.open;

      if (today.low <= pos.buyPrice * (1 + sl)) {
        sellPrice = Math.max(today.open, pos.buyPrice * (1 + sl));
        sell = true;
      } else if (bestSell.get(date)?.has(code)) {
        sell = true;
      } else if (holdDays >= maxHold) {
        sell = true;
      }
      if (sell) {
        const sp = sellPrice * (1 - SLIPPAGE);
        const net = sp * pos.quantity * (1 - FEE_RATE - TAX_RATE);
        cash += net;
        positions.delete(code);
      }
    }

    // 매수
    const buyCands = bestBuy.get(date);
    if (buyCands && positions.size < 10) {
      for (const code of buyCands) {
        if (positions.has(code) || positions.size >= 10) continue;
        const candles = stockCandles.get(code)!;
        const tidx = candles.findIndex((c) => c.date === date);
        if (tidx < 0) continue;
        const today = candles[tidx]!;

        let sv = 0;
        for (const p of positions.values()) {
          const pc = stockCandles.get(p.stockCode)!;
          const pi = pc.findIndex((c) => c.date === date);
          sv +=
            (pi >= 0 ? (pc[pi]!.adjClose ?? pc[pi]!.close) : p.buyPrice) *
            p.quantity;
        }
        const totalEq = cash + sv;
        const maxAmt = Math.min(totalEq * 0.2, cash * 0.95);
        const bp = today.open * (1 + SLIPPAGE);
        const qty = Math.floor(maxAmt / bp);
        if (qty <= 0) continue;
        const cost = bp * qty * (1 + FEE_RATE);
        if (cost > cash) continue;
        cash -= cost;
        positions.set(code, {
          stockCode: code,
          buyDate: date,
          buyDateIdx: di,
          buyPrice: bp,
          quantity: qty,
          cost
        });
      }
    }
  }

  // 마지막 월
  let sv = 0;
  for (const pos of positions.values()) {
    const candles = stockCandles.get(pos.stockCode)!;
    const last = candles[candles.length - 1];
    sv += (last ? (last.adjClose ?? last.close) : pos.buyPrice) * pos.quantity;
  }
  const endEq = cash + sv;
  const bullCount = monthRegimes.filter((r) => r === 'BULL').length;
  const bearCount = monthRegimes.filter((r) => r === 'BEAR').length;
  const dominant =
    bullCount > bearCount ? 'BULL' : bearCount > bullCount ? 'BEAR' : 'NEUTRAL';
  monthlyEquity.push({
    month: currentMonth,
    startEq: monthStart,
    endEq,
    regime: dominant
  });

  for (const m of monthlyEquity) {
    const ret = m.startEq > 0 ? (m.endEq - m.startEq) / m.startEq : 0;
    const bar =
      ret >= 0
        ? '█'.repeat(Math.min(Math.round(ret * 100), 50))
        : '░'.repeat(Math.min(Math.round(Math.abs(ret) * 100), 50));
    console.log(
      `  ${m.month}  ${m.regime.padEnd(7)}  ${(ret >= 0 ? '+' : '') + (ret * 100).toFixed(1) + '%'}`.padEnd(
        30
      ),
      `${ret >= 0 ? '' : '-'}${bar}`
    );
  }
}

db.close();
console.log('\n완료.');
