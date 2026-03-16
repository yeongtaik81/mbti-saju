/**
 * 상승장 전용 전략 탐색
 *
 * 전략 유형:
 * 1. 눌림목 매수 (Pullback): 상승추세에서 단기 하락 시 매수
 * 2. RSI 과매도 반등: 상승추세에서 RSI 과매도 시 매수
 * 3. 이동평균 지지 매수: 가격이 MA까지 하락 후 반등 시 매수
 * 4. 변동성 돌파 (기존): 비교 기준
 *
 * 사용법:
 *   pnpm --filter @trading/engine optimize:bull
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

const SLIPPAGE = 0.001;
const COST = 0.00015 * 2 + 0.0018; // 수수료+세금
const MA_REGIME = 20;
const MAX_HOLD = 10;

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

// breadth 계산
const dailyBreadth = new Map<string, number>();
for (const date of allDates) {
  let above = 0,
    total = 0;
  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    const idx = candles.findIndex((c) => c.date === date);
    if (idx < MA_REGIME) continue;
    let sum = 0;
    for (let j = idx - MA_REGIME + 1; j <= idx; j++) sum += candles[j]!.close;
    total++;
    if (candles[idx]!.close > sum / MA_REGIME) above++;
  }
  dailyBreadth.set(date, total > 0 ? above / total : 0);
}

const dateIdx = new Map<string, number>();
allDates.forEach((d, i) => dateIdx.set(d, i));

console.log(`=== 상승장 전용 전략 탐색 ===`);
console.log(
  `종목: ${stockCodes.length}개, 기간: ${allDates[0]} ~ ${allDates[allDates.length - 1]}\n`
);

// ── 공통 시뮬 함수 ──
interface Signal {
  buyPrice: number; // 매수 예상가 (익일 시가)
  forward: { open: number; high: number; low: number; close: number }[];
}

function evalSignals(
  signals: Signal[],
  holdDays: number,
  sl: number,
  tp: number
): {
  count: number;
  avg: number;
  median: number;
  winRate: number;
  pf: number;
} {
  if (signals.length === 0)
    return { count: 0, avg: 0, median: 0, winRate: 0, pf: 0 };

  const returns: number[] = [];
  for (const sig of signals) {
    if (sig.forward.length < holdDays) continue;

    // 매수: 익일 시가
    const buyPrice = sig.buyPrice * (1 + SLIPPAGE);
    let sellPrice = 0;

    for (let d = 0; d < holdDays; d++) {
      const fd = sig.forward[d]!;
      if (d > 0) {
        if (sl < 0 && fd.open <= buyPrice * (1 + sl)) {
          sellPrice = fd.open * (1 - SLIPPAGE);
          break;
        }
        if (tp > 0 && fd.open >= buyPrice * (1 + tp)) {
          sellPrice = fd.open * (1 - SLIPPAGE);
          break;
        }
      }
      if (sl < 0 && fd.low <= buyPrice * (1 + sl)) {
        sellPrice = buyPrice * (1 + sl) * (1 - SLIPPAGE);
        break;
      }
      if (tp > 0 && fd.high >= buyPrice * (1 + tp)) {
        sellPrice = buyPrice * (1 + tp) * (1 - SLIPPAGE);
        break;
      }
    }

    if (sellPrice === 0) {
      sellPrice = sig.forward[holdDays - 1]!.open * (1 - SLIPPAGE);
    }

    returns.push((sellPrice - buyPrice) / buyPrice - COST);
  }

  if (returns.length === 0)
    return { count: 0, avg: 0, median: 0, winRate: 0, pf: 0 };

  returns.sort((a, b) => a - b);
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const median = returns[Math.floor(returns.length / 2)]!;
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  const totalProfit = wins.reduce((s, r) => s + r, 0);
  const totalLoss = Math.abs(losses.reduce((s, r) => s + r, 0));

  return {
    count: returns.length,
    avg,
    median,
    winRate: wins.length / returns.length,
    pf: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99 : 0
  };
}

// ══════════════════════════════════════
// 전략 1: 눌림목 매수 (Pullback)
// 조건: 상승추세 (shortMA > longMA) + N일 연속 하락 + 익일 시가 매수
// ══════════════════════════════════════
function genPullbackSignals(
  shortMa: number,
  longMa: number,
  consecDown: number,
  breadthMin: number
): Signal[] {
  const signals: Signal[] = [];
  const lookback = Math.max(longMa, 20) + 10;

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < lookback + MAX_HOLD) continue;

    const smVals = sma(candles, shortMa);
    const lmVals = sma(candles, longMa);

    for (let i = consecDown; i < candles.length - MAX_HOLD; i++) {
      const today = candles[i]!;
      const sm = smVals[i],
        lm = lmVals[i];
      if (sm == null || lm == null || !(sm > lm)) continue;

      // 상승장 필터
      const di = dateIdx.get(today.date);
      if (di == null || di < 1) continue;
      const breadth = dailyBreadth.get(allDates[di - 1]!) ?? 0;
      if (breadth < breadthMin) continue;

      // N일 연속 하락 체크
      let allDown = true;
      for (let d = 0; d < consecDown; d++) {
        const c = candles[i - d]!;
        if (c.close >= c.open) {
          allDown = false;
          break;
        }
      }
      if (!allDown) continue;

      // 매수가 = 익일 시가
      const forward: Signal['forward'] = [];
      for (let d = 1; d <= MAX_HOLD; d++) {
        if (i + d >= candles.length) break;
        const fc = candles[i + d]!;
        forward.push({
          open: fc.open,
          high: fc.high,
          low: fc.low,
          close: fc.close
        });
      }
      if (forward.length < MAX_HOLD) continue;

      signals.push({ buyPrice: forward[0]!.open, forward: forward.slice(1) });
    }
  }
  return signals;
}

// ══════════════════════════════════════
// 전략 2: RSI 과매도 반등
// 조건: 상승추세 + RSI < threshold + 익일 시가 매수
// ══════════════════════════════════════
function genRsiOversoldSignals(
  shortMa: number,
  longMa: number,
  rsiPeriod: number,
  rsiThreshold: number,
  breadthMin: number
): Signal[] {
  const signals: Signal[] = [];
  const lookback = Math.max(longMa, rsiPeriod, 20) + 10;

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < lookback + MAX_HOLD) continue;

    const smVals = sma(candles, shortMa);
    const lmVals = sma(candles, longMa);
    const rsiVals = rsi(candles, rsiPeriod);

    for (let i = 1; i < candles.length - MAX_HOLD; i++) {
      const today = candles[i]!;
      const sm = smVals[i],
        lm = lmVals[i],
        cr = rsiVals[i];
      if (sm == null || lm == null || cr == null) continue;
      if (!(sm > lm)) continue;
      if (cr >= rsiThreshold) continue;

      const di = dateIdx.get(today.date);
      if (di == null || di < 1) continue;
      const breadth = dailyBreadth.get(allDates[di - 1]!) ?? 0;
      if (breadth < breadthMin) continue;

      const forward: Signal['forward'] = [];
      for (let d = 1; d <= MAX_HOLD; d++) {
        if (i + d >= candles.length) break;
        const fc = candles[i + d]!;
        forward.push({
          open: fc.open,
          high: fc.high,
          low: fc.low,
          close: fc.close
        });
      }
      if (forward.length < MAX_HOLD) continue;

      signals.push({ buyPrice: forward[0]!.open, forward: forward.slice(1) });
    }
  }
  return signals;
}

// ══════════════════════════════════════
// 전략 3: MA 지지 매수
// 조건: 상승추세 + 가격이 longMA 근처까지 하락 (close/longMA < threshold)
// ══════════════════════════════════════
function genMaSupportSignals(
  shortMa: number,
  longMa: number,
  maProximity: number,
  breadthMin: number
): Signal[] {
  const signals: Signal[] = [];
  const lookback = Math.max(longMa, 20) + 10;

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < lookback + MAX_HOLD) continue;

    const smVals = sma(candles, shortMa);
    const lmVals = sma(candles, longMa);

    for (let i = 1; i < candles.length - MAX_HOLD; i++) {
      const today = candles[i]!;
      const sm = smVals[i],
        lm = lmVals[i];
      if (sm == null || lm == null || !(sm > lm)) continue;

      // 가격이 장기MA 근처 (예: close/longMA < 1.02)
      const ratio = today.close / lm;
      if (ratio >= maProximity || ratio < 0.95) continue; // 너무 많이 빠진 건 제외

      const di = dateIdx.get(today.date);
      if (di == null || di < 1) continue;
      const breadth = dailyBreadth.get(allDates[di - 1]!) ?? 0;
      if (breadth < breadthMin) continue;

      const forward: Signal['forward'] = [];
      for (let d = 1; d <= MAX_HOLD; d++) {
        if (i + d >= candles.length) break;
        const fc = candles[i + d]!;
        forward.push({
          open: fc.open,
          high: fc.high,
          low: fc.low,
          close: fc.close
        });
      }
      if (forward.length < MAX_HOLD) continue;

      signals.push({ buyPrice: forward[0]!.open, forward: forward.slice(1) });
    }
  }
  return signals;
}

// ══════════════════════════════════════
// 전략 4: 변동성 돌파 (상승장) - 비교용
// ══════════════════════════════════════
function genBreakoutSignals(
  k: number,
  shortMa: number,
  longMa: number,
  rsiPeriod: number,
  rsiLow: number,
  rsiHigh: number,
  breadthMin: number
): Signal[] {
  const signals: Signal[] = [];
  const lookback = Math.max(longMa, rsiPeriod, 20) + 10;

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < lookback + MAX_HOLD) continue;

    const smVals = sma(candles, shortMa);
    const lmVals = sma(candles, longMa);
    const rsiVals = rsi(candles, rsiPeriod);

    for (let i = 1; i < candles.length - MAX_HOLD; i++) {
      const prev = candles[i - 1]!;
      const today = candles[i]!;
      const range = prev.high - prev.low;
      if (range <= 0) continue;

      const threshold = today.open + range * k;
      const sm = smVals[i],
        lm = lmVals[i],
        cr = rsiVals[i];
      if (sm == null || lm == null || cr == null) continue;
      if (today.high < threshold || !(sm > lm) || cr < rsiLow || cr > rsiHigh)
        continue;

      const di = dateIdx.get(today.date);
      if (di == null || di < 1) continue;
      const breadth = dailyBreadth.get(allDates[di - 1]!) ?? 0;
      if (breadth < breadthMin) continue;

      const forward: Signal['forward'] = [];
      for (let d = 1; d <= MAX_HOLD; d++) {
        if (i + d >= candles.length) break;
        const fc = candles[i + d]!;
        forward.push({
          open: fc.open,
          high: fc.high,
          low: fc.low,
          close: fc.close
        });
      }
      if (forward.length < MAX_HOLD) continue;

      // 돌파 매수가
      signals.push({ buyPrice: threshold, forward });
    }
  }
  return signals;
}

// ══════════════════════════════════════
// 테스트 실행
// ══════════════════════════════════════

interface StratResult {
  name: string;
  params: string;
  hold: number;
  sl: number;
  tp: number;
  count: number;
  avg: number;
  median: number;
  winRate: number;
  pf: number;
}

const allResults: StratResult[] = [];
const holdOptions = [1, 2, 3, 5, 7];
const slOptions = [0, -0.03, -0.05, -0.07];
const tpOptions = [0, 0.03, 0.05, 0.07];

function testStrategy(name: string, params: string, signals: Signal[]) {
  for (const hold of holdOptions) {
    for (const sl of slOptions) {
      for (const tp of tpOptions) {
        const r = evalSignals(signals, hold, sl, tp);
        if (r.count >= 50) {
          allResults.push({ name, params, hold, sl, tp, ...r });
        }
      }
    }
  }
}

// ── 전략 1: 눌림목 ──
console.log('전략 1: 눌림목 매수 (Pullback)');
const pullbackConfigs = [
  { short: 5, long: 20, down: 2, breadth: 0.5 },
  { short: 5, long: 20, down: 3, breadth: 0.5 },
  { short: 10, long: 30, down: 2, breadth: 0.5 },
  { short: 10, long: 30, down: 3, breadth: 0.5 },
  { short: 5, long: 20, down: 2, breadth: 0.6 },
  { short: 5, long: 20, down: 3, breadth: 0.6 },
  { short: 10, long: 60, down: 2, breadth: 0.5 },
  { short: 10, long: 60, down: 3, breadth: 0.5 },
  { short: 3, long: 10, down: 2, breadth: 0.5 },
  { short: 3, long: 10, down: 3, breadth: 0.5 },
  { short: 3, long: 10, down: 2, breadth: 0.6 }
];
for (const cfg of pullbackConfigs) {
  const signals = genPullbackSignals(
    cfg.short,
    cfg.long,
    cfg.down,
    cfg.breadth
  );
  const label = `MA=${cfg.short}/${cfg.long} ${cfg.down}일하락 B≥${(cfg.breadth * 100).toFixed(0)}%`;
  console.log(`  ${label}: ${signals.length}건`);
  testStrategy('눌림목', label, signals);
}

// ── 전략 2: RSI 과매도 ──
console.log('\n전략 2: RSI 과매도 반등');
const rsiConfigs = [
  { short: 5, long: 20, rsiP: 14, rsiTh: 30, breadth: 0.5 },
  { short: 5, long: 20, rsiP: 14, rsiTh: 35, breadth: 0.5 },
  { short: 5, long: 20, rsiP: 14, rsiTh: 40, breadth: 0.5 },
  { short: 5, long: 20, rsiP: 7, rsiTh: 30, breadth: 0.5 },
  { short: 5, long: 20, rsiP: 7, rsiTh: 35, breadth: 0.5 },
  { short: 10, long: 30, rsiP: 14, rsiTh: 35, breadth: 0.5 },
  { short: 10, long: 60, rsiP: 14, rsiTh: 35, breadth: 0.5 },
  { short: 3, long: 10, rsiP: 14, rsiTh: 35, breadth: 0.5 },
  { short: 5, long: 20, rsiP: 14, rsiTh: 35, breadth: 0.6 },
  { short: 5, long: 20, rsiP: 14, rsiTh: 40, breadth: 0.6 }
];
for (const cfg of rsiConfigs) {
  const signals = genRsiOversoldSignals(
    cfg.short,
    cfg.long,
    cfg.rsiP,
    cfg.rsiTh,
    cfg.breadth
  );
  const label = `MA=${cfg.short}/${cfg.long} RSI${cfg.rsiP}<${cfg.rsiTh} B≥${(cfg.breadth * 100).toFixed(0)}%`;
  console.log(`  ${label}: ${signals.length}건`);
  testStrategy('RSI과매도', label, signals);
}

// ── 전략 3: MA 지지 ──
console.log('\n전략 3: MA 지지 매수');
const maConfigs = [
  { short: 5, long: 20, prox: 1.01, breadth: 0.5 },
  { short: 5, long: 20, prox: 1.02, breadth: 0.5 },
  { short: 5, long: 20, prox: 1.03, breadth: 0.5 },
  { short: 10, long: 30, prox: 1.02, breadth: 0.5 },
  { short: 10, long: 60, prox: 1.02, breadth: 0.5 },
  { short: 10, long: 60, prox: 1.03, breadth: 0.5 },
  { short: 3, long: 10, prox: 1.02, breadth: 0.5 },
  { short: 5, long: 20, prox: 1.02, breadth: 0.6 },
  { short: 5, long: 20, prox: 1.03, breadth: 0.6 }
];
for (const cfg of maConfigs) {
  const signals = genMaSupportSignals(
    cfg.short,
    cfg.long,
    cfg.prox,
    cfg.breadth
  );
  const label = `MA=${cfg.short}/${cfg.long} ≤${((cfg.prox - 1) * 100).toFixed(0)}% B≥${(cfg.breadth * 100).toFixed(0)}%`;
  console.log(`  ${label}: ${signals.length}건`);
  testStrategy('MA지지', label, signals);
}

// ── 전략 4: 변동성 돌파 (비교용) ──
console.log('\n전략 4: 변동성 돌파 (상승장, 비교용)');
const breakConfigs = [
  { k: 0.4, short: 5, long: 20, rsiP: 14, rsiL: 20, rsiH: 80, breadth: 0.5 },
  { k: 0.5, short: 5, long: 20, rsiP: 14, rsiL: 20, rsiH: 80, breadth: 0.5 },
  { k: 0.4, short: 10, long: 60, rsiP: 14, rsiL: 20, rsiH: 80, breadth: 0.5 },
  { k: 0.5, short: 10, long: 60, rsiP: 14, rsiL: 20, rsiH: 80, breadth: 0.5 }
];
for (const cfg of breakConfigs) {
  const signals = genBreakoutSignals(
    cfg.k,
    cfg.short,
    cfg.long,
    cfg.rsiP,
    cfg.rsiL,
    cfg.rsiH,
    cfg.breadth
  );
  const label = `K=${cfg.k} MA=${cfg.short}/${cfg.long} B≥${(cfg.breadth * 100).toFixed(0)}%`;
  console.log(`  ${label}: ${signals.length}건`);
  testStrategy('변동성돌파', label, signals);
}

// ══════════════════════════════════════
// 결과 출력
// ══════════════════════════════════════
console.log(`\n총 유효 결과: ${allResults.length}개\n`);

allResults.sort((a, b) => b.pf - a.pf);

// 전략 유형별 TOP 5
const stratTypes = ['눌림목', 'RSI과매도', 'MA지지', '변동성돌파'];

for (const type of stratTypes) {
  const typeResults = allResults.filter(
    (r) => r.name === type && r.count >= 50
  );
  typeResults.sort((a, b) => b.pf - a.pf);

  console.log(`=== ${type} — TOP 10 (PF순, ≥50건) ===`);
  console.log('─'.repeat(120));
  console.log(
    '#'.padStart(3),
    '| 파라미터'.padEnd(38),
    '| 보유'.padEnd(5),
    '| SL'.padEnd(5),
    '| TP'.padEnd(5),
    '| 건수'.padEnd(7),
    '| 평균%'.padEnd(8),
    '| 중앙%'.padEnd(8),
    '| 승률'.padEnd(7),
    '| PF'
  );
  console.log('─'.repeat(120));

  for (let i = 0; i < Math.min(10, typeResults.length); i++) {
    const r = typeResults[i]!;
    console.log(
      `${i + 1}`.padStart(3),
      `| ${r.params}`.padEnd(38),
      `| ${r.hold}d`.padEnd(5),
      `| ${r.sl === 0 ? 'X' : (r.sl * 100).toFixed(0) + '%'}`.padEnd(5),
      `| ${r.tp === 0 ? 'X' : (r.tp * 100).toFixed(0) + '%'}`.padEnd(5),
      `| ${r.count}`.padEnd(7),
      `| ${(r.avg * 100).toFixed(2)}`.padEnd(8),
      `| ${(r.median * 100).toFixed(2)}`.padEnd(8),
      `| ${(r.winRate * 100).toFixed(1)}`.padEnd(7),
      `| ${r.pf.toFixed(2)}`
    );
  }
  console.log();
}

// 전체 TOP 15
console.log('=== 전체 TOP 15 (전략 유형 무관, PF순, ≥100건) ===');
const robust = allResults.filter((r) => r.count >= 100);
robust.sort((a, b) => b.pf - a.pf);
console.log('─'.repeat(130));
console.log(
  '#'.padStart(3),
  '| 전략'.padEnd(10),
  '| 파라미터'.padEnd(38),
  '| 보유'.padEnd(5),
  '| SL'.padEnd(5),
  '| TP'.padEnd(5),
  '| 건수'.padEnd(7),
  '| 평균%'.padEnd(8),
  '| 중앙%'.padEnd(8),
  '| 승률'.padEnd(7),
  '| PF'
);
console.log('─'.repeat(130));
for (let i = 0; i < Math.min(15, robust.length); i++) {
  const r = robust[i]!;
  console.log(
    `${i + 1}`.padStart(3),
    `| ${r.name}`.padEnd(10),
    `| ${r.params}`.padEnd(38),
    `| ${r.hold}d`.padEnd(5),
    `| ${r.sl === 0 ? 'X' : (r.sl * 100).toFixed(0) + '%'}`.padEnd(5),
    `| ${r.tp === 0 ? 'X' : (r.tp * 100).toFixed(0) + '%'}`.padEnd(5),
    `| ${r.count}`.padEnd(7),
    `| ${(r.avg * 100).toFixed(2)}`.padEnd(8),
    `| ${(r.median * 100).toFixed(2)}`.padEnd(8),
    `| ${(r.winRate * 100).toFixed(1)}`.padEnd(7),
    `| ${r.pf.toFixed(2)}`
  );
}

// 최종 추천: 상승장 + 하락장 조합
console.log('\n════════════════════════════════════');
console.log('  상승장 + 하락장 최적 조합');
console.log('════════════════════════════════════');

// 상승장 최고 (눌림목/RSI/MA지지 중)
const bullBest = allResults
  .filter((r) => r.name !== '변동성돌파' && r.count >= 100)
  .sort((a, b) => b.pf - a.pf)[0];

// 하락장 최고 (이전 분석 결과)
console.log('\n  [상승장] 최적:');
if (bullBest) {
  console.log(`    전략: ${bullBest.name}`);
  console.log(`    파라미터: ${bullBest.params}`);
  console.log(
    `    보유: ${bullBest.hold}일, SL=${bullBest.sl === 0 ? '없음' : (bullBest.sl * 100).toFixed(0) + '%'}, TP=${bullBest.tp === 0 ? '없음' : (bullBest.tp * 100).toFixed(0) + '%'}`
  );
  console.log(
    `    성과: ${bullBest.count}건, avg=${(bullBest.avg * 100).toFixed(2)}%, PF=${bullBest.pf.toFixed(2)}, 승률=${(bullBest.winRate * 100).toFixed(1)}%`
  );
}

console.log('\n  [하락장] 최적 (이전 분석):');
console.log('    전략: 변동성 돌파');
console.log(
  '    파라미터: K=0.4 MA=10/60 RSI=14(20-80), breadth<40%, 7일 보유'
);
console.log('    성과: 358건, avg=3.22%, PF=3.64, 승률=67.0%');

db.close();
