/**
 * 4가지 전략 개별/조합 파라미터 최적화
 *
 * 전략:
 *   1. 듀얼 모멘텀 (Dual Momentum) — 절대 + 상대 모멘텀
 *   2. 이동평균 크로스오버 (MA Crossover) — 골든/데드 크로스
 *   3. 볼린저 밴드 + RSI (BB+RSI) — 평균회귀
 *   4. 터틀 트레이딩 (Turtle Trading) — 채널 돌파
 *
 * 사용법:
 *   pnpm --filter @trading/engine tsx src/scripts/optimize-strategies.ts
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import Database from 'better-sqlite3';
import {
  sma,
  ema,
  rsi,
  atr,
  bollingerBands,
  donchianChannel
} from '../strategy/indicators.js';
import type { Candle } from '@trading/shared/types';

const DB_PATH =
  process.env['DB_PATH'] || path.resolve(__dirname, '../../data/trading.db');
const db = new Database(DB_PATH, { readonly: true });

// ── 비용 상수 ──
const SLIPPAGE = 0.001;
const FEE_RATE = 0.00015; // 매수+매도 각 0.015%
const TAX_RATE = 0.0018; // 거래세
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

console.log(`=== 4가지 전략 최적화 ===`);
console.log(`종목: ${stockCodes.length}개, 거래일: ${allDates.length}일`);
console.log(`기간: ${allDates[0]} ~ ${allDates[allDates.length - 1]}`);
console.log(`초기자금: ${(INITIAL_CAPITAL / 10000).toFixed(0)}만원\n`);

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

// 날짜→인덱스 매핑
const dateIndexMap = new Map<string, number>();
allDates.forEach((d, i) => dateIndexMap.set(d, i));

// ══════════════════════════════════════════
// 공통 시뮬레이션 (포트폴리오 기반)
// ══════════════════════════════════════════

interface TradeSignal {
  stockCode: string;
  buyDate: string;
  buyPrice: number;
  sellCondition: 'stop_loss' | 'take_profit' | 'exit_signal' | 'max_hold';
}

interface PortfolioResult {
  strategyName: string;
  params: string;
  totalReturn: number;
  cagr: number;
  mdd: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  totalTrades: number;
  avgHoldDays: number;
}

interface Position {
  stockCode: string;
  buyDate: string;
  buyDateIdx: number;
  buyPrice: number;
  quantity: number;
  cost: number;
}

/**
 * 포트폴리오 시뮬레이션 — 일별 순회하면서 매수/매도 결정
 */
function simulatePortfolio(
  buySignals: Map<string, Set<string>>, // date → Set<stockCode>
  sellSignals: Map<string, Set<string>>, // date → Set<stockCode>
  stopLossRate: number,
  takeProfitRate: number,
  maxHoldDays: number,
  maxPositions: number,
  maxWeight: number
): Omit<PortfolioResult, 'strategyName' | 'params'> {
  let cash = INITIAL_CAPITAL;
  const positions = new Map<string, Position>();
  const trades: { pnl: number; pnlRate: number; holdDays: number }[] = [];
  const equityCurve: number[] = [];
  let peak = INITIAL_CAPITAL;
  let maxDD = 0;

  for (let di = 0; di < allDates.length; di++) {
    const date = allDates[di]!;

    // 1. 매도 체크 (기존 포지션)
    for (const [code, pos] of [...positions.entries()]) {
      const candles = stockCandles.get(code)!;
      const todayIdx = candles.findIndex((c) => c.date === date);
      if (todayIdx < 0) continue;
      const today = candles[todayIdx]!;
      const holdDays = di - pos.buyDateIdx;

      let sell = false;
      let sellPrice = today.open; // 기본: 당일 시가

      // 손절
      if (stopLossRate < 0 && today.low <= pos.buyPrice * (1 + stopLossRate)) {
        sellPrice = Math.max(today.open, pos.buyPrice * (1 + stopLossRate));
        sell = true;
      }
      // 익절
      else if (
        takeProfitRate > 0 &&
        today.high >= pos.buyPrice * (1 + takeProfitRate)
      ) {
        sellPrice = Math.min(today.open, pos.buyPrice * (1 + takeProfitRate));
        if (sellPrice < pos.buyPrice * (1 + takeProfitRate)) {
          sellPrice = pos.buyPrice * (1 + takeProfitRate);
        }
        sell = true;
      }
      // 매도 시그널
      else if (sellSignals.get(date)?.has(code)) {
        sellPrice = today.open;
        sell = true;
      }
      // 최대 보유일 초과
      else if (maxHoldDays > 0 && holdDays >= maxHoldDays) {
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

    // 2. 매수 체크
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
        if (maxAmount < today.open * 2) continue; // 최소 2주 매수

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

    // 3. 에쿼티 기록
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

  // 미청산 포지션 강제 청산
  const lastDate = allDates[allDates.length - 1]!;
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

  // 메트릭 계산
  const finalEquity = cash;
  const totalReturn = (finalEquity - INITIAL_CAPITAL) / INITIAL_CAPITAL;
  const days = allDates.length;
  const years = days / 252;
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

  // Sharpe
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

  return {
    totalReturn,
    cagr,
    mdd: maxDD,
    winRate,
    profitFactor,
    sharpeRatio,
    totalTrades: trades.length,
    avgHoldDays
  };
}

// ══════════════════════════════════════════
// 전략 1: 듀얼 모멘텀 (Dual Momentum)
// ══════════════════════════════════════════

function runDualMomentum(
  lookback: number,
  holdDays: number,
  topN: number,
  sl: number,
  tp: number
): PortfolioResult {
  const buySignals = new Map<string, Set<string>>();
  const sellSignals = new Map<string, Set<string>>();

  // 리밸런싱: holdDays 간격으로 리밸런싱
  for (let di = lookback; di < allDates.length; di += holdDays) {
    const date = allDates[di]!;
    const prevDate = allDates[di - lookback]!;

    // 각 종목의 모멘텀(수익률) 계산
    const momentums: { code: string; ret: number }[] = [];
    for (const code of stockCodes) {
      const candles = stockCandles.get(code)!;
      const todayIdx = candles.findIndex((c) => c.date === date);
      const pastIdx = candles.findIndex((c) => c.date === prevDate);
      if (todayIdx < 0 || pastIdx < 0) continue;

      const todayClose =
        candles[todayIdx]!.adjClose ?? candles[todayIdx]!.close;
      const pastClose = candles[pastIdx]!.adjClose ?? candles[pastIdx]!.close;
      if (pastClose <= 0) continue;

      const ret = (todayClose - pastClose) / pastClose;
      // 절대 모멘텀: 양수만
      if (ret > 0) {
        momentums.push({ code, ret });
      }
    }

    // 상대 모멘텀: 상위 N종목
    momentums.sort((a, b) => b.ret - a.ret);
    const selected = momentums.slice(0, topN);

    const buys = new Set<string>();
    for (const { code } of selected) buys.add(code);
    buySignals.set(date, buys);

    // 이전 보유 중 미선정 종목은 매도
    const sells = new Set<string>();
    // 다음 리밸런싱일에 매도 처리 (sellSignals에 넣으면 됨)
    for (const code of stockCodes) {
      if (!buys.has(code)) sells.add(code);
    }
    sellSignals.set(date, sells);
  }

  const params = `lookback=${lookback} hold=${holdDays} top=${topN} sl=${sl === 0 ? 'X' : (sl * 100).toFixed(0) + '%'} tp=${tp === 0 ? 'X' : (tp * 100).toFixed(0) + '%'}`;
  const result = simulatePortfolio(
    buySignals,
    sellSignals,
    sl,
    tp,
    0,
    topN,
    1.0 / topN
  );
  return { strategyName: '듀얼모멘텀', params, ...result };
}

// ══════════════════════════════════════════
// 전략 2: 이동평균 크로스오버 (MA Crossover)
// ══════════════════════════════════════════

function runMACrossover(
  shortPeriod: number,
  longPeriod: number,
  sl: number,
  tp: number,
  maxHold: number
): PortfolioResult {
  const buySignals = new Map<string, Set<string>>();
  const sellSignals = new Map<string, Set<string>>();

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < longPeriod + 2) continue;

    const shortMa = sma(candles, shortPeriod);
    const longMa = sma(candles, longPeriod);

    for (let i = 1; i < candles.length; i++) {
      const sm = shortMa[i];
      const lm = longMa[i];
      const prevSm = shortMa[i - 1];
      const prevLm = longMa[i - 1];
      if (sm == null || lm == null || prevSm == null || prevLm == null)
        continue;

      const date = candles[i]!.date;

      // 골든 크로스: 전일 shortMA ≤ longMA → 오늘 shortMA > longMA
      if (prevSm <= prevLm && sm > lm) {
        if (!buySignals.has(date)) buySignals.set(date, new Set());
        buySignals.get(date)!.add(code);
      }

      // 데드 크로스: 전일 shortMA ≥ longMA → 오늘 shortMA < longMA
      if (prevSm >= prevLm && sm < lm) {
        if (!sellSignals.has(date)) sellSignals.set(date, new Set());
        sellSignals.get(date)!.add(code);
      }
    }
  }

  const params = `MA=${shortPeriod}/${longPeriod} sl=${sl === 0 ? 'X' : (sl * 100).toFixed(0) + '%'} tp=${tp === 0 ? 'X' : (tp * 100).toFixed(0) + '%'} maxHold=${maxHold === 0 ? 'X' : maxHold + 'd'}`;
  const result = simulatePortfolio(
    buySignals,
    sellSignals,
    sl,
    tp,
    maxHold,
    10,
    0.2
  );
  return { strategyName: 'MA크로스오버', params, ...result };
}

// ══════════════════════════════════════════
// 전략 3: 볼린저 밴드 + RSI
// ══════════════════════════════════════════

function runBBRSI(
  bbPeriod: number,
  bbK: number,
  rsiPeriod: number,
  rsiLow: number,
  rsiHigh: number,
  sl: number,
  tp: number,
  maxHold: number
): PortfolioResult {
  const buySignals = new Map<string, Set<string>>();
  const sellSignals = new Map<string, Set<string>>();

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < Math.max(bbPeriod, rsiPeriod) + 2) continue;

    const bb = bollingerBands(candles, bbPeriod, bbK);
    const rsiVals = rsi(candles, rsiPeriod);

    for (let i = 1; i < candles.length; i++) {
      const close = candles[i]!.adjClose ?? candles[i]!.close;
      const low = candles[i]!.low;
      const high = candles[i]!.high;
      const bbLower = bb.lower[i];
      const bbUpper = bb.upper[i];
      const bbMiddle = bb.middle[i];
      const r = rsiVals[i];

      if (bbLower == null || bbUpper == null || bbMiddle == null || r == null)
        continue;

      const date = candles[i]!.date;

      // 매수: 종가가 하단밴드 이하 + RSI 과매도
      if (close <= bbLower && r <= rsiLow) {
        if (!buySignals.has(date)) buySignals.set(date, new Set());
        buySignals.get(date)!.add(code);
      }

      // 매도: 종가가 상단밴드 이상 또는 RSI 과매수
      if (close >= bbUpper || r >= rsiHigh) {
        if (!sellSignals.has(date)) sellSignals.set(date, new Set());
        sellSignals.get(date)!.add(code);
      }
    }
  }

  const params = `BB=${bbPeriod}(${bbK}) RSI=${rsiPeriod}(${rsiLow}-${rsiHigh}) sl=${sl === 0 ? 'X' : (sl * 100).toFixed(0) + '%'} tp=${tp === 0 ? 'X' : (tp * 100).toFixed(0) + '%'} hold=${maxHold === 0 ? 'X' : maxHold + 'd'}`;
  const result = simulatePortfolio(
    buySignals,
    sellSignals,
    sl,
    tp,
    maxHold,
    10,
    0.2
  );
  return { strategyName: 'BB+RSI', params, ...result };
}

// ══════════════════════════════════════════
// 전략 4: 터틀 트레이딩 (Turtle Trading)
// ══════════════════════════════════════════

function runTurtle(
  entryPeriod: number,
  exitPeriod: number,
  atrPeriod: number,
  atrMultiple: number,
  sl: number,
  maxHold: number
): PortfolioResult {
  const buySignals = new Map<string, Set<string>>();
  const sellSignals = new Map<string, Set<string>>();

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    const lookback = Math.max(entryPeriod, exitPeriod, atrPeriod) + 2;
    if (candles.length < lookback) continue;

    const dc = donchianChannel(candles, entryPeriod);
    const exitDc = donchianChannel(candles, exitPeriod);
    const atrVals = atr(candles, atrPeriod);

    for (let i = 1; i < candles.length; i++) {
      const prevUpper = dc.upper[i - 1]; // 전일 N일 최고가
      const exitLower = exitDc.lower[i];
      const close = candles[i]!.adjClose ?? candles[i]!.close;
      const high = candles[i]!.high;

      if (prevUpper == null) continue;

      const date = candles[i]!.date;

      // 매수: 고가가 전일 N일 최고가 돌파
      if (high > prevUpper) {
        if (!buySignals.has(date)) buySignals.set(date, new Set());
        buySignals.get(date)!.add(code);
      }

      // 매도: 종가가 exit N일 최저가 이탈
      if (exitLower != null && close < exitLower) {
        if (!sellSignals.has(date)) sellSignals.set(date, new Set());
        sellSignals.get(date)!.add(code);
      }
    }
  }

  const params = `entry=${entryPeriod} exit=${exitPeriod} ATR=${atrPeriod}(${atrMultiple}x) sl=${sl === 0 ? 'X' : (sl * 100).toFixed(0) + '%'} hold=${maxHold === 0 ? 'X' : maxHold + 'd'}`;
  const result = simulatePortfolio(
    buySignals,
    sellSignals,
    sl,
    0,
    maxHold,
    10,
    0.2
  );
  return { strategyName: '터틀트레이딩', params, ...result };
}

// ══════════════════════════════════════════
// 조합 전략
// ══════════════════════════════════════════

function intersectSignals(
  a: Map<string, Set<string>>,
  b: Map<string, Set<string>>
): Map<string, Set<string>> {
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
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  for (const date of allKeys) {
    const merged = new Set<string>();
    const aSet = a.get(date);
    const bSet = b.get(date);
    if (aSet) for (const c of aSet) merged.add(c);
    if (bSet) for (const c of bSet) merged.add(c);
    result.set(date, merged);
  }
  return result;
}

// 시그널 생성 함수 (조합용 — 시그널만 반환)
function generateMACrossoverSignals(
  shortP: number,
  longP: number
): { buy: Map<string, Set<string>>; sell: Map<string, Set<string>> } {
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

function generateBBRSISignals(
  bbPeriod: number,
  bbK: number,
  rsiPeriod: number,
  rsiLow: number,
  rsiHigh: number
): { buy: Map<string, Set<string>>; sell: Map<string, Set<string>> } {
  const buySignals = new Map<string, Set<string>>();
  const sellSignals = new Map<string, Set<string>>();

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < Math.max(bbPeriod, rsiPeriod) + 2) continue;
    const bb = bollingerBands(candles, bbPeriod, bbK);
    const rsiVals = rsi(candles, rsiPeriod);

    for (let i = 1; i < candles.length; i++) {
      const close = candles[i]!.adjClose ?? candles[i]!.close;
      const bbLower = bb.lower[i],
        bbUpper = bb.upper[i],
        r = rsiVals[i];
      if (bbLower == null || bbUpper == null || r == null) continue;
      const date = candles[i]!.date;

      if (close <= bbLower && r <= rsiLow) {
        if (!buySignals.has(date)) buySignals.set(date, new Set());
        buySignals.get(date)!.add(code);
      }
      if (close >= bbUpper || r >= rsiHigh) {
        if (!sellSignals.has(date)) sellSignals.set(date, new Set());
        sellSignals.get(date)!.add(code);
      }
    }
  }
  return { buy: buySignals, sell: sellSignals };
}

function generateTurtleSignals(
  entryP: number,
  exitP: number
): { buy: Map<string, Set<string>>; sell: Map<string, Set<string>> } {
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

function runCombination(
  name: string,
  params: string,
  buySignals: Map<string, Set<string>>,
  sellSignals: Map<string, Set<string>>,
  sl: number,
  tp: number,
  maxHold: number
): PortfolioResult {
  const result = simulatePortfolio(
    buySignals,
    sellSignals,
    sl,
    tp,
    maxHold,
    10,
    0.2
  );
  return { strategyName: name, params, ...result };
}

// ══════════════════════════════════════════
// 파라미터 그리드 & 실행
// ══════════════════════════════════════════

const allResults: PortfolioResult[] = [];

// ─── 1. 듀얼 모멘텀 ───
console.log('\n[1/4] 듀얼 모멘텀 최적화...');
const dmLookbacks = [20, 40, 60, 90, 120];
const dmHoldDays = [5, 10, 20, 40];
const dmTopNs = [3, 5, 10];
const dmSLs = [0, -0.05, -0.07, -0.1];
const dmTPs = [0, 0.05, 0.1];

let dmCount = 0;
const dmTotal =
  dmLookbacks.length *
  dmHoldDays.length *
  dmTopNs.length *
  dmSLs.length *
  dmTPs.length;
for (const lb of dmLookbacks) {
  for (const hd of dmHoldDays) {
    for (const topN of dmTopNs) {
      for (const sl of dmSLs) {
        for (const tp of dmTPs) {
          dmCount++;
          const r = runDualMomentum(lb, hd, topN, sl, tp);
          if (r.totalTrades >= 10) allResults.push(r);
        }
      }
    }
  }
}
console.log(
  `  ${dmTotal}개 조합 → ${allResults.filter((r) => r.strategyName === '듀얼모멘텀').length}개 유효`
);

// ─── 2. MA 크로스오버 ───
console.log('\n[2/4] MA 크로스오버 최적화...');
const maShorts = [5, 10, 20];
const maLongs = [20, 50, 60, 100, 120];
const maSLs = [0, -0.05, -0.07, -0.1];
const maTPs = [0, 0.05, 0.07, 0.1];
const maHolds = [0, 10, 20, 40];

let maCount = 0;
for (const sp of maShorts) {
  for (const lp of maLongs) {
    if (sp >= lp) continue;
    for (const sl of maSLs) {
      for (const tp of maTPs) {
        for (const mh of maHolds) {
          maCount++;
          const r = runMACrossover(sp, lp, sl, tp, mh);
          if (r.totalTrades >= 10) allResults.push(r);
        }
      }
    }
  }
}
console.log(
  `  ${maCount}개 조합 → ${allResults.filter((r) => r.strategyName === 'MA크로스오버').length}개 유효`
);

// ─── 3. 볼린저 밴드 + RSI ───
console.log('\n[3/4] 볼린저 밴드 + RSI 최적화...');
const bbPeriods = [20];
const bbKs = [1.5, 2.0, 2.5];
const bbRsiPeriods = [7, 14];
const bbRsiLows = [20, 30, 35];
const bbRsiHighs = [65, 70, 80];
const bbSLs = [0, -0.05, -0.07];
const bbTPs = [0, 0.03, 0.05, 0.07];
const bbHolds = [0, 5, 10, 20];

let bbCount = 0;
for (const bp of bbPeriods) {
  for (const bk of bbKs) {
    for (const rp of bbRsiPeriods) {
      for (const rl of bbRsiLows) {
        for (const rh of bbRsiHighs) {
          for (const sl of bbSLs) {
            for (const tp of bbTPs) {
              for (const mh of bbHolds) {
                bbCount++;
                const r = runBBRSI(bp, bk, rp, rl, rh, sl, tp, mh);
                if (r.totalTrades >= 10) allResults.push(r);
              }
            }
          }
        }
      }
    }
  }
}
console.log(
  `  ${bbCount}개 조합 → ${allResults.filter((r) => r.strategyName === 'BB+RSI').length}개 유효`
);

// ─── 4. 터틀 트레이딩 ───
console.log('\n[4/4] 터틀 트레이딩 최적화...');
const tEntries = [10, 20, 40, 55];
const tExits = [5, 10, 20];
const tATRPeriods = [14, 20];
const tATRMults = [1.5, 2.0, 3.0];
const tSLs = [0, -0.05, -0.07, -0.1];
const tHolds = [0, 10, 20, 40];

let tCount = 0;
for (const ep of tEntries) {
  for (const xp of tExits) {
    if (xp >= ep) continue;
    for (const ap of tATRPeriods) {
      for (const am of tATRMults) {
        for (const sl of tSLs) {
          for (const mh of tHolds) {
            tCount++;
            const r = runTurtle(ep, xp, ap, am, sl, mh);
            if (r.totalTrades >= 10) allResults.push(r);
          }
        }
      }
    }
  }
}
console.log(
  `  ${tCount}개 조합 → ${allResults.filter((r) => r.strategyName === '터틀트레이딩').length}개 유효`
);

// ─── 조합 전략 ───
console.log('\n[조합] 전략 조합 테스트...');

// 각 전략 최적 파라미터 시그널 미리 생성
const maSignals5_20 = generateMACrossoverSignals(5, 20);
const maSignals10_50 = generateMACrossoverSignals(10, 50);
const maSignals5_60 = generateMACrossoverSignals(5, 60);
const bbSignals20_2_14_30_70 = generateBBRSISignals(20, 2.0, 14, 30, 70);
const bbSignals20_2_7_30_70 = generateBBRSISignals(20, 2.0, 7, 30, 70);
const bbSignals20_15_14_30_70 = generateBBRSISignals(20, 1.5, 14, 30, 70);
const turtleSignals20_10 = generateTurtleSignals(20, 10);
const turtleSignals40_20 = generateTurtleSignals(40, 20);
const turtleSignals55_20 = generateTurtleSignals(55, 20);

// 조합: MA + BB+RSI (교집합 = 둘 다 매수 시그널일 때만 매수)
const combos: {
  name: string;
  params: string;
  buy: Map<string, Set<string>>;
  sell: Map<string, Set<string>>;
}[] = [
  // MA + BB+RSI 교집합
  {
    name: 'MA+BB교집합',
    params: 'MA5/20∩BB20(2)RSI14(30-70)',
    buy: intersectSignals(maSignals5_20.buy, bbSignals20_2_14_30_70.buy),
    sell: unionSignals(maSignals5_20.sell, bbSignals20_2_14_30_70.sell)
  },
  {
    name: 'MA+BB교집합',
    params: 'MA10/50∩BB20(2)RSI14(30-70)',
    buy: intersectSignals(maSignals10_50.buy, bbSignals20_2_14_30_70.buy),
    sell: unionSignals(maSignals10_50.sell, bbSignals20_2_14_30_70.sell)
  },
  // MA + 터틀 교집합
  {
    name: 'MA+터틀교집합',
    params: 'MA5/20∩Turtle20/10',
    buy: intersectSignals(maSignals5_20.buy, turtleSignals20_10.buy),
    sell: unionSignals(maSignals5_20.sell, turtleSignals20_10.sell)
  },
  {
    name: 'MA+터틀교집합',
    params: 'MA10/50∩Turtle40/20',
    buy: intersectSignals(maSignals10_50.buy, turtleSignals40_20.buy),
    sell: unionSignals(maSignals10_50.sell, turtleSignals40_20.sell)
  },
  // BB+RSI + 터틀 교집합
  {
    name: 'BB+터틀교집합',
    params: 'BB20(2)RSI14(30-70)∩Turtle20/10',
    buy: intersectSignals(bbSignals20_2_14_30_70.buy, turtleSignals20_10.buy),
    sell: unionSignals(bbSignals20_2_14_30_70.sell, turtleSignals20_10.sell)
  },
  // MA + BB+RSI 합집합 (둘 중 하나라도 매수)
  {
    name: 'MA+BB합집합',
    params: 'MA5/20∪BB20(2)RSI14(30-70)',
    buy: unionSignals(maSignals5_20.buy, bbSignals20_2_14_30_70.buy),
    sell: intersectSignals(maSignals5_20.sell, bbSignals20_2_14_30_70.sell)
  },
  // 3중 교집합
  {
    name: '3중교집합',
    params: 'MA5/20∩BB20(2)RSI14∩Turtle20/10',
    buy: intersectSignals(
      intersectSignals(maSignals5_20.buy, bbSignals20_2_14_30_70.buy),
      turtleSignals20_10.buy
    ),
    sell: unionSignals(
      unionSignals(maSignals5_20.sell, bbSignals20_2_14_30_70.sell),
      turtleSignals20_10.sell
    )
  },
  // MA + BB (다른 파라미터)
  {
    name: 'MA+BB교집합',
    params: 'MA5/60∩BB20(1.5)RSI14(30-70)',
    buy: intersectSignals(maSignals5_60.buy, bbSignals20_15_14_30_70.buy),
    sell: unionSignals(maSignals5_60.sell, bbSignals20_15_14_30_70.sell)
  },
  // 터틀 + BB (다른 파라미터)
  {
    name: 'BB+터틀교집합',
    params: 'BB20(2)RSI7(30-70)∩Turtle55/20',
    buy: intersectSignals(bbSignals20_2_7_30_70.buy, turtleSignals55_20.buy),
    sell: unionSignals(bbSignals20_2_7_30_70.sell, turtleSignals55_20.sell)
  }
];

const comboSLs = [0, -0.05, -0.07];
const comboTPs = [0, 0.05, 0.07];
const comboHolds = [0, 10, 20];

for (const combo of combos) {
  for (const sl of comboSLs) {
    for (const tp of comboTPs) {
      for (const mh of comboHolds) {
        const fullParams = `${combo.params} sl=${sl === 0 ? 'X' : (sl * 100).toFixed(0) + '%'} tp=${tp === 0 ? 'X' : (tp * 100).toFixed(0) + '%'} hold=${mh === 0 ? 'X' : mh + 'd'}`;
        const r = runCombination(
          combo.name,
          fullParams,
          combo.buy,
          combo.sell,
          sl,
          tp,
          mh
        );
        if (r.totalTrades >= 5) allResults.push(r);
      }
    }
  }
}
console.log(
  `  조합 → ${allResults.filter((r) => r.strategyName.includes('교집합') || r.strategyName.includes('합집합')).length}개 유효`
);

// ══════════════════════════════════════════
// 결과 출력
// ══════════════════════════════════════════

console.log(`\n${'═'.repeat(180)}`);
console.log(`총 유효 결과: ${allResults.length}개`);
console.log(`${'═'.repeat(180)}\n`);

function printTable(
  title: string,
  results: PortfolioResult[],
  limit: number = 20
) {
  console.log(`\n=== ${title} ===`);
  console.log('─'.repeat(180));
  console.log(
    '#'.padStart(3),
    '| 전략'.padEnd(16),
    '| 파라미터'.padEnd(55),
    '| 수익률'.padEnd(9),
    '| CAGR'.padEnd(9),
    '| MDD'.padEnd(9),
    '| 승률'.padEnd(8),
    '| PF'.padEnd(7),
    '| Sharpe'.padEnd(8),
    '| 거래'.padEnd(7),
    '| 평균보유'.padEnd(8)
  );
  console.log('─'.repeat(180));
  for (let i = 0; i < Math.min(limit, results.length); i++) {
    const r = results[i]!;
    console.log(
      `${i + 1}`.padStart(3),
      `| ${r.strategyName}`.padEnd(16),
      `| ${r.params}`.padEnd(55),
      `| ${(r.totalReturn * 100).toFixed(1)}%`.padEnd(9),
      `| ${(r.cagr * 100).toFixed(1)}%`.padEnd(9),
      `| ${(r.mdd * 100).toFixed(1)}%`.padEnd(9),
      `| ${(r.winRate * 100).toFixed(1)}%`.padEnd(8),
      `| ${r.profitFactor.toFixed(2)}`.padEnd(7),
      `| ${r.sharpeRatio.toFixed(2)}`.padEnd(8),
      `| ${r.totalTrades}`.padEnd(7),
      `| ${r.avgHoldDays.toFixed(1)}d`.padEnd(8)
    );
  }
}

// 전략별 TOP 10
const strategyNames = ['듀얼모멘텀', 'MA크로스오버', 'BB+RSI', '터틀트레이딩'];
for (const name of strategyNames) {
  const filtered = allResults.filter((r) => r.strategyName === name);
  filtered.sort((a, b) => b.totalReturn - a.totalReturn);
  printTable(`${name} TOP 10 (수익률순)`, filtered, 10);
}

// 조합 전략 TOP 10
const comboResults = allResults.filter(
  (r) => r.strategyName.includes('교집합') || r.strategyName.includes('합집합')
);
comboResults.sort((a, b) => b.totalReturn - a.totalReturn);
printTable('조합 전략 TOP 10 (수익률순)', comboResults, 10);

// 전체 TOP 30 (수익률순)
const byReturn = [...allResults].sort((a, b) => b.totalReturn - a.totalReturn);
printTable('전체 TOP 30 (수익률순)', byReturn, 30);

// Sharpe 순 TOP 20 (거래 30건 이상)
const bySharpe = allResults
  .filter((r) => r.totalTrades >= 30)
  .sort((a, b) => b.sharpeRatio - a.sharpeRatio);
printTable('전체 TOP 20 (Sharpe순, 거래≥30건)', bySharpe, 20);

// PF 순 TOP 20 (거래 30건 이상)
const byPF = allResults
  .filter((r) => r.totalTrades >= 30)
  .sort((a, b) => b.profitFactor - a.profitFactor);
printTable('전체 TOP 20 (PF순, 거래≥30건)', byPF, 20);

// 리스크 조정 수익 (수익률/MDD)
const byRiskAdj = allResults
  .filter((r) => r.totalTrades >= 20 && r.mdd > 0)
  .map((r) => ({ ...r, riskAdj: r.totalReturn / r.mdd }))
  .sort((a, b) => b.riskAdj - a.riskAdj);
console.log(`\n=== TOP 20 (수익률/MDD 순, 거래≥20건) ===`);
console.log('─'.repeat(180));
for (let i = 0; i < Math.min(20, byRiskAdj.length); i++) {
  const r = byRiskAdj[i]!;
  console.log(
    `${i + 1}`.padStart(3),
    `| ${r.strategyName}`.padEnd(16),
    `| ${r.params}`.padEnd(55),
    `| Ret=${(r.totalReturn * 100).toFixed(1)}%`.padEnd(12),
    `| MDD=${(r.mdd * 100).toFixed(1)}%`.padEnd(12),
    `| Ret/MDD=${r.riskAdj.toFixed(2)}`.padEnd(14),
    `| PF=${r.profitFactor.toFixed(2)}`.padEnd(9),
    `| ${r.totalTrades}건`
  );
}

// ══════════════════════════════════════════
// 최종 추천
// ══════════════════════════════════════════

console.log(`\n${'═'.repeat(80)}`);
console.log('  최종 추천');
console.log(`${'═'.repeat(80)}`);

if (byReturn.length > 0) {
  const r = byReturn[0]!;
  console.log(`\n  [1순위 — 최고 수익률]`);
  console.log(`  전략: ${r.strategyName}`);
  console.log(`  파라미터: ${r.params}`);
  console.log(
    `  수익률: ${(r.totalReturn * 100).toFixed(1)}% | CAGR: ${(r.cagr * 100).toFixed(1)}% | MDD: ${(r.mdd * 100).toFixed(1)}%`
  );
  console.log(
    `  승률: ${(r.winRate * 100).toFixed(1)}% | PF: ${r.profitFactor.toFixed(2)} | Sharpe: ${r.sharpeRatio.toFixed(2)} | ${r.totalTrades}건`
  );
}

if (bySharpe.length > 0) {
  const r = bySharpe[0]!;
  console.log(`\n  [2순위 — 최고 Sharpe (리스크 대비 수익)]`);
  console.log(`  전략: ${r.strategyName}`);
  console.log(`  파라미터: ${r.params}`);
  console.log(
    `  수익률: ${(r.totalReturn * 100).toFixed(1)}% | CAGR: ${(r.cagr * 100).toFixed(1)}% | MDD: ${(r.mdd * 100).toFixed(1)}%`
  );
  console.log(
    `  승률: ${(r.winRate * 100).toFixed(1)}% | PF: ${r.profitFactor.toFixed(2)} | Sharpe: ${r.sharpeRatio.toFixed(2)} | ${r.totalTrades}건`
  );
}

if (byRiskAdj.length > 0) {
  const r = byRiskAdj[0]!;
  console.log(`\n  [3순위 — 최고 수익/MDD 비율]`);
  console.log(`  전략: ${r.strategyName}`);
  console.log(`  파라미터: ${r.params}`);
  console.log(
    `  수익률: ${(r.totalReturn * 100).toFixed(1)}% | CAGR: ${(r.cagr * 100).toFixed(1)}% | MDD: ${(r.mdd * 100).toFixed(1)}%`
  );
  console.log(
    `  승률: ${(r.winRate * 100).toFixed(1)}% | PF: ${r.profitFactor.toFixed(2)} | Sharpe: ${r.sharpeRatio.toFixed(2)} | ${r.totalTrades}건`
  );
}

db.close();
console.log('\n완료.');
