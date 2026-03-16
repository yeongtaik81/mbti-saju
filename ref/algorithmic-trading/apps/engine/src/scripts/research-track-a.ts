/**
 * Track A: ETF 듀얼 모멘텀 연구
 * Step 2: Baseline (dual_momentum, buy_and_hold, equal_weight)
 * Step 3: Parameter sweep (lookback, holdDays, topN)
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLabBacktest } from '../strategy/lab/run-lab-backtest.js';
import { runSweep } from '../strategy/lab/sweep.js';
import { STRATEGY_TYPE } from '../strategy/lab/types.js';
import {
  ensureLabSchema,
  ensureAlgorithm,
  saveLabResult
} from '../strategy/lab/lab-store.js';
import type {
  LabBacktestResult,
  LabRiskParams
} from '../strategy/lab/types.js';
import type { SweepResult } from '../strategy/lab/sweep.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/trading.db');

// ── Track A Universe: ETF ──
// 자산 클래스가 다양하고 상관관계가 낮은 ETF로 구성
const TRACK_A_UNIVERSE = [
  '069500', // KODEX 200 (국내 대표지수)
  '229200', // KODEX 코스닥150
  '360750', // TIGER 미국S&P500
  '371460', // TIGER 미국나스닥100
  '395160', // KODEX 미국반도체MV (섹터)
  '305720', // KODEX 2차전지산업 (섹터)
  '132030', // KODEX 골드선물(H) (원자재)
  '364690', // KODEX 미국채10년선물 (채권)
  '379800', // KODEX 미국달러선물 (통화)
  '161510' // ARIRANG 고배당주 (배당)
];

// ── 공통 설정 ──
// 듀얼 모멘텀은 보유 종목 수가 적으므로 리스크 관리도 다르게 설정
const COMMON_RISK: LabRiskParams = {
  stopLossRate: 0.15, // ETF는 개별주보다 여유있게
  takeProfitRate: 0.5, // 추세 추종이므로 여유있게
  maxHoldDays: 60, // holdDays 리밸런싱에 의존
  maxPositions: 5,
  maxWeight: 0.25
};

const START_DATE = '2025-06-01'; // 3개월 warm-up 확보 (데이터 시작: 2025-03-15)
const END_DATE = '2026-03-12'; // 데이터 마지막 날
const INITIAL_CAPITAL = 100_000_000; // 1억

// ── 헬퍼 ──
function fmt(n: number, pct = false): string {
  if (pct) return (n * 100).toFixed(2) + '%';
  return n.toFixed(2);
}

function printResult(r: LabBacktestResult): void {
  console.log(
    `  Return: ${fmt(r.totalReturn, true)}  CAGR: ${fmt(r.cagr, true)}  MDD: ${fmt(r.mdd, true)}  Sharpe: ${fmt(r.sharpeRatio)}  WinRate: ${fmt(r.winRate, true)}  PF: ${fmt(r.profitFactor)}  Trades: ${r.totalTrades}  AvgHold: ${fmt(r.avgHoldDays)}d`
  );
}

function printSweepTop(sweep: SweepResult, topN = 5): void {
  const n = Math.min(topN, sweep.ranking.length);
  for (let rank = 0; rank < n; rank++) {
    const idx = sweep.ranking[rank]!;
    const r = sweep.results[idx]!;
    const c = sweep.configs[idx]!;
    console.log(`  #${rank + 1} params=${JSON.stringify(c.params)}`);
    printResult(r);
  }
}

// ── Main ──
const db = new Database(DB_PATH, { readonly: true });
const writeDb = new Database(DB_PATH);
ensureLabSchema(writeDb);

// 알고리즘 등록
const algorithms = [
  {
    id: 'TRACK_A_BH',
    name: 'ETF Buy & Hold',
    strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
    description: 'ETF 10종 단순 매수 후 보유',
    hypothesis: 'Benchmark — 패시브 전략 대비 알파 측정용'
  },
  {
    id: 'TRACK_A_EW',
    name: 'ETF Equal Weight',
    strategyType: STRATEGY_TYPE.EQUAL_WEIGHT,
    description: 'ETF 10종 동일가중 리밸런싱',
    hypothesis: 'Benchmark — 주기적 리밸런싱이 B&H 대비 유효한가?'
  },
  {
    id: 'TRACK_A_DM',
    name: 'Dual Momentum Default',
    strategyType: STRATEGY_TYPE.DUAL_MOMENTUM,
    description: '듀얼 모멘텀 기본 파라미터',
    hypothesis: 'ETF에서 절대+상대 모멘텀이 B&H를 이길 수 있는가?'
  },
  {
    id: 'TRACK_A_DM_SWEEP',
    name: 'Dual Momentum Sweep',
    strategyType: STRATEGY_TYPE.DUAL_MOMENTUM,
    description: '듀얼 모멘텀 파라미터 스윕',
    hypothesis: '최적 lookback/holdDays/topN 탐색'
  }
];
for (const algo of algorithms) {
  ensureAlgorithm(writeDb, algo);
}

console.log('═══════════════════════════════════════════════════════');
console.log(' Track A: ETF 듀얼 모멘텀 — Baseline Experiments');
console.log(`  Universe: ${TRACK_A_UNIVERSE.length} ETFs`);
console.log(`  Period: ${START_DATE} ~ ${END_DATE}`);
console.log(`  Capital: ${(INITIAL_CAPITAL / 1e8).toFixed(0)}억원`);
console.log('═══════════════════════════════════════════════════════\n');

// ── Step 2: Baselines ──

// 1. Buy & Hold
console.log('▶ Buy & Hold (benchmark)');
const bhResult = runLabBacktest(db, {
  algorithmId: 'TRACK_A_BH',
  strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
  name: 'ETF Buy & Hold Benchmark',
  params: {},
  riskParams: {
    ...COMMON_RISK,
    stopLossRate: 1,
    takeProfitRate: 100,
    maxHoldDays: 9999,
    maxPositions: 10,
    maxWeight: 0.12
  },
  stockCodes: TRACK_A_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(bhResult);
saveLabResult(writeDb, bhResult);

// 2. Equal Weight (monthly rebalance)
console.log('\n▶ Equal Weight (20-day rebalance, benchmark)');
const ewResult = runLabBacktest(db, {
  algorithmId: 'TRACK_A_EW',
  strategyType: STRATEGY_TYPE.EQUAL_WEIGHT,
  name: 'ETF Equal Weight Benchmark',
  params: { rebalanceDays: 20 },
  riskParams: {
    ...COMMON_RISK,
    stopLossRate: 1,
    takeProfitRate: 100,
    maxHoldDays: 9999,
    maxPositions: 10,
    maxWeight: 0.12
  },
  stockCodes: TRACK_A_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(ewResult);
saveLabResult(writeDb, ewResult);

// 3. Dual Momentum (default params)
console.log('\n▶ Dual Momentum (default: lookback=60, holdDays=20, topN=5)');
const dmResult = runLabBacktest(db, {
  algorithmId: 'TRACK_A_DM',
  strategyType: STRATEGY_TYPE.DUAL_MOMENTUM,
  name: 'Dual Momentum Default',
  params: { lookback: 60, holdDays: 20, topN: 5 },
  riskParams: COMMON_RISK,
  stockCodes: TRACK_A_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(dmResult);
saveLabResult(writeDb, dmResult);

console.log('\n═══════════════════════════════════════════════════════');
console.log(' Step 3: Parameter Sweep');
console.log('═══════════════════════════════════════════════════════\n');

// ── Step 3: Parameter Sweep ──
console.log('▶ Dual Momentum Parameter Sweep');
const dmSweep = runSweep(db, {
  baseConfig: {
    algorithmId: 'TRACK_A_DM_SWEEP',
    strategyType: STRATEGY_TYPE.DUAL_MOMENTUM,
    name: 'DM Sweep',
    riskParams: COMMON_RISK,
    stockCodes: TRACK_A_UNIVERSE,
    startDate: START_DATE,
    endDate: END_DATE,
    initialCapital: INITIAL_CAPITAL
  },
  paramGrid: {
    lookback: [40, 60, 80],
    holdDays: [10, 20, 30],
    topN: [1, 3, 5]
  }
});
console.log(`  Total combos: ${dmSweep.results.length}`);
console.log('  Top 10:');
printSweepTop(dmSweep, 10);
for (const r of dmSweep.results) saveLabResult(writeDb, r);

// ── Summary ──
console.log('\n═══════════════════════════════════════════════════════');
console.log(' Summary: Baseline vs Best Sweep');
console.log('═══════════════════════════════════════════════════════');

const bestDm = dmSweep.results[dmSweep.ranking[0]!]!;

const summary = [
  { name: 'Buy & Hold', r: bhResult },
  { name: 'Equal Weight', r: ewResult },
  { name: 'DM (default)', r: dmResult },
  { name: 'DM (best)', r: bestDm }
];

console.log(
  '\n  Strategy          | Return   | CAGR     | MDD      | Sharpe | WinRate  | PF    | Trades'
);
console.log(
  '  ─────────────────|─────────|─────────|─────────|────────|─────────|───────|───────'
);
for (const { name, r } of summary) {
  console.log(
    `  ${name.padEnd(18)}| ${fmt(r.totalReturn, true).padStart(8)} | ${fmt(r.cagr, true).padStart(8)} | ${fmt(r.mdd, true).padStart(8)} | ${fmt(r.sharpeRatio).padStart(6)} | ${fmt(r.winRate, true).padStart(8)} | ${fmt(r.profitFactor).padStart(5)} | ${String(r.totalTrades).padStart(6)}`
  );
}

db.close();
writeDb.close();
console.log('\nDone.');
