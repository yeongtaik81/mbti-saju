/**
 * K값, MA, RSI 파라미터 + 시장 국면별 전략 전체 최적화
 *
 * 사용법:
 *   pnpm --filter @trading/engine optimize:full
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
const FEE_RATE = 0.00015;
const TAX_RATE = 0.0018;
const MA_PERIOD_FOR_REGIME = 20;
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

console.log(`=== 전체 파라미터 최적화 ===`);
console.log(`종목: ${stockCodes.length}개, 거래일: ${allDates.length}일`);
console.log(`기간: ${allDates[0]} ~ ${allDates[allDates.length - 1]}\n`);

// ── 종목별 일봉 로드 ──
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

// ── 일별 breadth 계산 ──
const dailyBreadth = new Map<string, number>();
for (const date of allDates) {
  let above = 0;
  let total = 0;
  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    const idx = candles.findIndex((c) => c.date === date);
    if (idx < MA_PERIOD_FOR_REGIME) continue;
    let sum = 0;
    for (let j = idx - MA_PERIOD_FOR_REGIME + 1; j <= idx; j++)
      sum += candles[j]!.close;
    const ma20 = sum / MA_PERIOD_FOR_REGIME;
    total++;
    if (candles[idx]!.close > ma20) above++;
  }
  dailyBreadth.set(date, total > 0 ? above / total : 0);
}

// dateIndex 캐시
const dateIndexMap = new Map<string, number>();
allDates.forEach((d, i) => dateIndexMap.set(d, i));

// ── 신호 생성 함수 ──
interface Signal {
  buyPrice: number;
  prevBreadth: number;
  forward: { open: number; high: number; low: number; close: number }[];
}

function computeSignals(
  k: number,
  shortMaPeriod: number,
  longMaPeriod: number,
  rsiPeriod: number,
  rsiLow: number,
  rsiHigh: number
): Signal[] {
  const signals: Signal[] = [];
  const lookback = Math.max(longMaPeriod, rsiPeriod, 20) + 10;

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < lookback + MAX_HOLD) continue;

    const smVals = sma(candles, shortMaPeriod);
    const lmVals = sma(candles, longMaPeriod);
    const rsiVals = rsi(candles, rsiPeriod);

    for (let i = 1; i < candles.length - MAX_HOLD; i++) {
      const prev = candles[i - 1]!;
      const today = candles[i]!;
      const prevRange = prev.high - prev.low;
      if (prevRange <= 0) continue;

      const threshold = today.open + prevRange * k;
      const sm = smVals[i];
      const lm = lmVals[i];
      const cr = rsiVals[i];
      if (sm == null || lm == null || cr == null) continue;
      if (today.high < threshold || !(sm > lm) || cr < rsiLow || cr > rsiHigh)
        continue;

      const dateIdx = dateIndexMap.get(today.date);
      if (dateIdx == null || dateIdx < 1) continue;
      const prevBreadth = dailyBreadth.get(allDates[dateIdx - 1]!) ?? 0;

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

      signals.push({ buyPrice: threshold, prevBreadth, forward });
    }
  }
  return signals;
}

// ── 시뮬레이션 함수 ──
interface Result {
  signalParams: string;
  regimeThreshold: number;
  bullHold: number;
  bearHold: number;
  stopLoss: number;
  takeProfit: number;
  totalTrades: number;
  avgReturn: number;
  medianReturn: number;
  winRate: number;
  profitFactor: number;
  bullTrades: number;
  bearTrades: number;
  bullAvg: number;
  bearAvg: number;
}

function simulate(
  signals: Signal[],
  rt: number,
  bullHold: number,
  bearHold: number,
  sl: number,
  tp: number
): Omit<Result, 'signalParams'> {
  const returns: number[] = [];
  const bullRets: number[] = [];
  const bearRets: number[] = [];

  for (const sig of signals) {
    const isBull = sig.prevBreadth >= rt;
    const hold = isBull ? bullHold : bearHold;
    if (hold === 0) continue;

    const buyPrice = sig.buyPrice * (1 + SLIPPAGE);
    let sellPrice = 0;

    for (let d = 0; d < hold && d < sig.forward.length; d++) {
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
      const exitIdx = Math.min(hold, sig.forward.length) - 1;
      sellPrice = sig.forward[exitIdx]!.open * (1 - SLIPPAGE);
    }

    const ret = (sellPrice - buyPrice) / buyPrice - FEE_RATE * 2 - TAX_RATE;
    returns.push(ret);
    if (isBull) bullRets.push(ret);
    else bearRets.push(ret);
  }

  if (returns.length === 0) {
    return {
      regimeThreshold: rt,
      bullHold,
      bearHold,
      stopLoss: sl,
      takeProfit: tp,
      totalTrades: 0,
      avgReturn: 0,
      medianReturn: 0,
      winRate: 0,
      profitFactor: 0,
      bullTrades: 0,
      bearTrades: 0,
      bullAvg: 0,
      bearAvg: 0
    };
  }

  returns.sort((a, b) => a - b);
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const median = returns[Math.floor(returns.length / 2)]!;
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  const wr = wins.length / returns.length;
  const tp2 = wins.reduce((s, r) => s + r, 0);
  const tl = Math.abs(losses.reduce((s, r) => s + r, 0));
  const pf = tl > 0 ? tp2 / tl : tp2 > 0 ? 99 : 0;

  return {
    regimeThreshold: rt,
    bullHold,
    bearHold,
    stopLoss: sl,
    takeProfit: tp,
    totalTrades: returns.length,
    avgReturn: avg,
    medianReturn: median,
    winRate: wr,
    profitFactor: pf,
    bullTrades: bullRets.length,
    bearTrades: bearRets.length,
    bullAvg:
      bullRets.length > 0
        ? bullRets.reduce((s, r) => s + r, 0) / bullRets.length
        : 0,
    bearAvg:
      bearRets.length > 0
        ? bearRets.reduce((s, r) => s + r, 0) / bearRets.length
        : 0
  };
}

// ══════════════════════════════════════════
// 파라미터 그리드
// ══════════════════════════════════════════

const kValues = [0.3, 0.4, 0.5, 0.6, 0.7];
const maConfigs = [
  { short: 3, long: 10 },
  { short: 5, long: 20 },
  { short: 5, long: 40 },
  { short: 10, long: 30 },
  { short: 10, long: 60 }
];
const rsiConfigs = [
  { period: 14, low: 30, high: 70 },
  { period: 14, low: 20, high: 80 },
  { period: 7, low: 30, high: 70 }
];

const regimeThresholds = [0.4, 0.5, 0.6];
const holdOptions = [0, 1, 3, 5, 7];
const slOptions = [0, -0.05, -0.07];
const tpOptions = [0, 0.05, 0.07];

const totalSignalSets = kValues.length * maConfigs.length * rsiConfigs.length;
console.log(`신호 파라미터 조합: ${totalSignalSets}개`);
console.log(
  `전략 파라미터 조합: ${regimeThresholds.length * holdOptions.length * holdOptions.length * slOptions.length * tpOptions.length}개 / 신호셋`
);

const allResults: Result[] = [];
let setIdx = 0;

for (const k of kValues) {
  for (const ma of maConfigs) {
    for (const rsiCfg of rsiConfigs) {
      setIdx++;
      const label = `K=${k} MA=${ma.short}/${ma.long} RSI=${rsiCfg.period}(${rsiCfg.low}-${rsiCfg.high})`;
      const signals = computeSignals(
        k,
        ma.short,
        ma.long,
        rsiCfg.period,
        rsiCfg.low,
        rsiCfg.high
      );

      if (signals.length < 50) {
        process.stdout.write(
          `  [${setIdx}/${totalSignalSets}] ${label}: ${signals.length}건 (skip)\n`
        );
        continue;
      }
      process.stdout.write(
        `  [${setIdx}/${totalSignalSets}] ${label}: ${signals.length}건 `
      );

      for (const rt of regimeThresholds) {
        for (const bh of holdOptions) {
          for (const bearH of holdOptions) {
            for (const sl of slOptions) {
              for (const tp of tpOptions) {
                const r = simulate(signals, rt, bh, bearH, sl, tp);
                if (r.totalTrades >= 50) {
                  allResults.push({ signalParams: label, ...r });
                }
              }
            }
          }
        }
      }
      process.stdout.write(`→ ${allResults.length}개 유효\n`);
    }
  }
}

console.log(`\n총 유효 결과: ${allResults.length}개\n`);

// ══════════════════════════════════════════
// 결과 출력
// ══════════════════════════════════════════

// PF 순 TOP 30 (거래 100건 이상)
const robust = allResults.filter((r) => r.totalTrades >= 100);
robust.sort((a, b) => b.profitFactor - a.profitFactor);

console.log('=== TOP 30 전략 (PF순, 거래≥100건) ===');
console.log('─'.repeat(150));
console.log(
  '#'.padStart(3),
  '| 신호 파라미터'.padEnd(35),
  '| RT'.padEnd(5),
  '| 상승'.padEnd(5),
  '| 하락'.padEnd(5),
  '| SL'.padEnd(5),
  '| TP'.padEnd(5),
  '| 거래'.padEnd(7),
  '| 평균%'.padEnd(8),
  '| 중앙%'.padEnd(8),
  '| 승률'.padEnd(7),
  '| PF'.padEnd(6),
  '| 상승%'.padEnd(8),
  '| 하락%'.padEnd(8)
);
console.log('─'.repeat(150));

for (let i = 0; i < Math.min(30, robust.length); i++) {
  const r = robust[i]!;
  console.log(
    `${i + 1}`.padStart(3),
    `| ${r.signalParams}`.padEnd(35),
    `| ${(r.regimeThreshold * 100).toFixed(0)}%`.padEnd(5),
    `| ${r.bullHold}d`.padEnd(5),
    `| ${r.bearHold}d`.padEnd(5),
    `| ${r.stopLoss === 0 ? 'X' : (r.stopLoss * 100).toFixed(0) + '%'}`.padEnd(
      5
    ),
    `| ${r.takeProfit === 0 ? 'X' : (r.takeProfit * 100).toFixed(0) + '%'}`.padEnd(
      5
    ),
    `| ${r.totalTrades}`.padEnd(7),
    `| ${(r.avgReturn * 100).toFixed(2)}`.padEnd(8),
    `| ${(r.medianReturn * 100).toFixed(2)}`.padEnd(8),
    `| ${(r.winRate * 100).toFixed(1)}`.padEnd(7),
    `| ${r.profitFactor.toFixed(2)}`.padEnd(6),
    `| ${(r.bullAvg * 100).toFixed(2)}`.padEnd(8),
    `| ${(r.bearAvg * 100).toFixed(2)}`.padEnd(8)
  );
}

// 수익률 순 TOP 10
const byReturn = [...robust].sort((a, b) => b.avgReturn - a.avgReturn);
console.log('\n=== TOP 10 전략 (평균수익률순, 거래≥100건) ===');
console.log('─'.repeat(100));
for (let i = 0; i < Math.min(10, byReturn.length); i++) {
  const r = byReturn[i]!;
  console.log(
    `${i + 1}`.padStart(3),
    `| ${r.signalParams}`.padEnd(35),
    `| RT=${(r.regimeThreshold * 100).toFixed(0)}% B${r.bullHold}/H${r.bearHold}`.padEnd(
      18
    ),
    `| SL=${r.stopLoss === 0 ? 'X' : (r.stopLoss * 100).toFixed(0) + '%'} TP=${r.takeProfit === 0 ? 'X' : (r.takeProfit * 100).toFixed(0) + '%'}`.padEnd(
      16
    ),
    `| ${r.totalTrades}건`.padEnd(7),
    `| avg=${(r.avgReturn * 100).toFixed(2)}%`.padEnd(13),
    `| PF=${r.profitFactor.toFixed(2)}`.padEnd(9)
  );
}

// 거래 500건 이상 중 최고
const highVol = allResults.filter((r) => r.totalTrades >= 500);
highVol.sort((a, b) => b.profitFactor - a.profitFactor);
console.log('\n=== TOP 10 전략 (PF순, 거래≥500건 — 높은 신뢰도) ===');
console.log('─'.repeat(100));
for (let i = 0; i < Math.min(10, highVol.length); i++) {
  const r = highVol[i]!;
  console.log(
    `${i + 1}`.padStart(3),
    `| ${r.signalParams}`.padEnd(35),
    `| RT=${(r.regimeThreshold * 100).toFixed(0)}% B${r.bullHold}/H${r.bearHold}`.padEnd(
      18
    ),
    `| SL=${r.stopLoss === 0 ? 'X' : (r.stopLoss * 100).toFixed(0) + '%'} TP=${r.takeProfit === 0 ? 'X' : (r.takeProfit * 100).toFixed(0) + '%'}`.padEnd(
      16
    ),
    `| ${r.totalTrades}건`.padEnd(7),
    `| avg=${(r.avgReturn * 100).toFixed(2)}%`.padEnd(13),
    `| PF=${r.profitFactor.toFixed(2)}`.padEnd(9),
    `| win=${(r.winRate * 100).toFixed(1)}%`
  );
}

// K값별 최고 전략
console.log('\n=== K값별 최고 전략 (거래≥100건) ===');
for (const k of kValues) {
  const kResults = robust.filter((r) => r.signalParams.startsWith(`K=${k}`));
  if (kResults.length === 0) continue;
  const best = kResults[0]!;
  console.log(
    `  K=${k}: ${best.signalParams} | RT=${(best.regimeThreshold * 100).toFixed(0)}% B${best.bullHold}/H${best.bearHold} SL=${best.stopLoss === 0 ? 'X' : (best.stopLoss * 100).toFixed(0) + '%'} TP=${best.takeProfit === 0 ? 'X' : (best.takeProfit * 100).toFixed(0) + '%'} | ${best.totalTrades}건 avg=${(best.avgReturn * 100).toFixed(2)}% PF=${best.profitFactor.toFixed(2)}`
  );
}

// MA별 최고 전략
console.log('\n=== MA설정별 최고 전략 (거래≥100건) ===');
for (const ma of maConfigs) {
  const maResults = robust.filter((r) =>
    r.signalParams.includes(`MA=${ma.short}/${ma.long}`)
  );
  if (maResults.length === 0) continue;
  const best = maResults[0]!;
  console.log(
    `  MA=${ma.short}/${ma.long}: ${best.signalParams} | RT=${(best.regimeThreshold * 100).toFixed(0)}% B${best.bullHold}/H${best.bearHold} | ${best.totalTrades}건 avg=${(best.avgReturn * 100).toFixed(2)}% PF=${best.profitFactor.toFixed(2)}`
  );
}

// 최종 추천
console.log('\n════════════════════════════════════');
console.log('  최종 추천');
console.log('════════════════════════════════════');

if (robust.length > 0) {
  const r = robust[0]!;
  console.log(`\n  [1순위 — 최고 PF]`);
  console.log(`  ${r.signalParams}`);
  console.log(
    `  국면: breadth≥${(r.regimeThreshold * 100).toFixed(0)}% → ${r.bullHold}일 보유, <${(r.regimeThreshold * 100).toFixed(0)}% → ${r.bearHold}일 보유`
  );
  console.log(
    `  손절: ${r.stopLoss === 0 ? '없음' : (r.stopLoss * 100).toFixed(0) + '%'}, 익절: ${r.takeProfit === 0 ? '없음' : (r.takeProfit * 100).toFixed(0) + '%'}`
  );
  console.log(
    `  성과: ${r.totalTrades}건, avg=${(r.avgReturn * 100).toFixed(2)}%, PF=${r.profitFactor.toFixed(2)}, 승률=${(r.winRate * 100).toFixed(1)}%`
  );
}

if (highVol.length > 0) {
  const r = highVol[0]!;
  console.log(`\n  [2순위 — 높은 신뢰도]`);
  console.log(`  ${r.signalParams}`);
  console.log(
    `  국면: breadth≥${(r.regimeThreshold * 100).toFixed(0)}% → ${r.bullHold}일 보유, <${(r.regimeThreshold * 100).toFixed(0)}% → ${r.bearHold}일 보유`
  );
  console.log(
    `  손절: ${r.stopLoss === 0 ? '없음' : (r.stopLoss * 100).toFixed(0) + '%'}, 익절: ${r.takeProfit === 0 ? '없음' : (r.takeProfit * 100).toFixed(0) + '%'}`
  );
  console.log(
    `  성과: ${r.totalTrades}건, avg=${(r.avgReturn * 100).toFixed(2)}%, PF=${r.profitFactor.toFixed(2)}, 승률=${(r.winRate * 100).toFixed(1)}%`
  );
}

db.close();
