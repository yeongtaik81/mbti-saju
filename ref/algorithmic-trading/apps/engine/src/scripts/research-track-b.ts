/**
 * Track B: 대형주 추세 추종 연구
 * Step 1: Baseline (turtle, volatility_breakout, ma_crossover, buy_and_hold, equal_weight)
 * Step 2: Parameter sweep (turtle, volatility_breakout)
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
  LabBacktestConfig,
  LabBacktestResult,
  LabRiskParams
} from '../strategy/lab/types.js';
import type { SweepResult } from '../strategy/lab/sweep.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/trading.db');

// ── Track B Universe: 거래대금 상위 30 ──
const TRACK_B_UNIVERSE = [
  '005930', // 삼성전자
  '000660', // SK하이닉스
  '034020', // 두산에너빌리티
  '005380', // 현대자동차
  '042660', // 한화오션
  '035420', // NAVER
  '012450', // 한화에어로스페이스
  '196170', // 알테오젠
  '086520', // 에코프로
  '042700', // 한미반도체
  '272210', // 한화시스템
  '006400', // 삼성SDI
  '035720', // 카카오
  '064350', // 현대로템
  '015760', // 한국전력공사
  '010140', // 삼성중공업
  '000270', // 기아
  '402340', // SK스퀘어
  '108490', // 로보티즈
  '298380', // 에이비엘바이오
  '105560', // KB금융
  '005490', // POSCO홀딩스
  '373220', // LG에너지솔루션
  '007660', // 이수페타시스
  '329180', // HD현대중공업
  '006800', // 미래에셋증권
  '000720', // 현대건설
  '267260', // HD현대일렉트릭
  '009830', // 한화솔루션
  '009150' // 삼성전기
];

// ── 공통 설정 ──
const COMMON_RISK: LabRiskParams = {
  stopLossRate: 0.08,
  takeProfitRate: 0.2,
  maxHoldDays: 60,
  maxPositions: 10,
  maxWeight: 0.15
};

const START_DATE = '2025-06-01'; // 3개월 warm-up 확보 (데이터 시작: 2025-03-05)
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

// ── DB 저장용 (writable) ──
const writeDb = new Database(DB_PATH);
ensureLabSchema(writeDb);

// 알고리즘 등록
const algorithms = [
  {
    id: 'TRACK_B_BH',
    name: 'Buy & Hold Benchmark',
    strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
    description: '대형주 30종 단순 매수 후 보유',
    hypothesis: 'Benchmark — 패시브 전략 대비 알파 측정용'
  },
  {
    id: 'TRACK_B_EW',
    name: 'Equal Weight Benchmark',
    strategyType: STRATEGY_TYPE.EQUAL_WEIGHT,
    description: '대형주 30종 동일가중 리밸런싱',
    hypothesis: 'Benchmark — 주기적 리밸런싱이 B&H 대비 유효한가?'
  },
  {
    id: 'TRACK_B_TURTLE',
    name: 'Turtle Default',
    strategyType: STRATEGY_TYPE.TURTLE,
    description: '돈치안 채널 돌파 기반 추세 추종',
    hypothesis: '대형주에서 20/10 돈치안 돌파가 유효한가?'
  },
  {
    id: 'TRACK_B_VB',
    name: 'Volatility Breakout Default',
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    description: 'ATR 기반 변동성 돌파',
    hypothesis: 'k=0.5 변동성 돌파가 대형주에서 작동하는가?'
  },
  {
    id: 'TRACK_B_MA',
    name: 'MA Crossover Default',
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    description: '이동평균 골든/데드 크로스',
    hypothesis: '5/20 MA 크로스가 대형주에서 유효한가?'
  },
  {
    id: 'TRACK_B_TURTLE_SWEEP',
    name: 'Turtle Sweep',
    strategyType: STRATEGY_TYPE.TURTLE,
    description: '터틀 파라미터 스윕',
    hypothesis: '최적 돈치안 채널 파라미터 탐색'
  },
  {
    id: 'TRACK_B_VB_SWEEP',
    name: 'VB Sweep',
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    description: 'VB 파라미터 스윕',
    hypothesis: '최적 k/MA 파라미터 탐색'
  },
  {
    id: 'TRACK_B_MA_SWEEP',
    name: 'MA Crossover Sweep',
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    description: 'MA 크로스 파라미터 스윕',
    hypothesis: '최적 MA 기간 탐색'
  }
];
for (const algo of algorithms) {
  ensureAlgorithm(writeDb, algo);
}

console.log('═══════════════════════════════════════════════════════');
console.log(' Track B: 대형주 추세 추종 — Baseline Experiments');
console.log(`  Universe: ${TRACK_B_UNIVERSE.length} stocks`);
console.log(`  Period: ${START_DATE} ~ ${END_DATE}`);
console.log(`  Capital: ${(INITIAL_CAPITAL / 1e8).toFixed(0)}억원`);
console.log('═══════════════════════════════════════════════════════\n');

// ── Step 1: Baselines ──

// 1. Buy & Hold
console.log('▶ Buy & Hold (benchmark)');
const bhResult = runLabBacktest(db, {
  algorithmId: 'TRACK_B_BH',
  strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
  name: 'Buy & Hold Benchmark',
  params: {},
  riskParams: {
    ...COMMON_RISK,
    stopLossRate: 1,
    takeProfitRate: 100,
    maxHoldDays: 9999,
    maxPositions: 30,
    maxWeight: 0.05
  },
  stockCodes: TRACK_B_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(bhResult);
saveLabResult(writeDb, bhResult);

// 2. Equal Weight (monthly rebalance)
console.log('\n▶ Equal Weight (20-day rebalance, benchmark)');
const ewResult = runLabBacktest(db, {
  algorithmId: 'TRACK_B_EW',
  strategyType: STRATEGY_TYPE.EQUAL_WEIGHT,
  name: 'Equal Weight Benchmark',
  params: { rebalanceDays: 20 },
  riskParams: {
    ...COMMON_RISK,
    stopLossRate: 1,
    takeProfitRate: 100,
    maxHoldDays: 9999,
    maxPositions: 30,
    maxWeight: 0.05
  },
  stockCodes: TRACK_B_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(ewResult);
saveLabResult(writeDb, ewResult);

// 3. Turtle
console.log('\n▶ Turtle (default params)');
const turtleResult = runLabBacktest(db, {
  algorithmId: 'TRACK_B_TURTLE',
  strategyType: STRATEGY_TYPE.TURTLE,
  name: 'Turtle Default',
  params: { entryPeriod: 20, exitPeriod: 10, atrPeriod: 14 },
  riskParams: COMMON_RISK,
  stockCodes: TRACK_B_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(turtleResult);
saveLabResult(writeDb, turtleResult);

// 4. Volatility Breakout
console.log('\n▶ Volatility Breakout (default params)');
const vbResult = runLabBacktest(db, {
  algorithmId: 'TRACK_B_VB',
  strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
  name: 'Volatility Breakout Default',
  params: {
    k: 0.5,
    shortMaPeriod: 5,
    longMaPeriod: 20,
    rsiPeriod: 14,
    rsiLow: 30,
    rsiHigh: 70
  },
  riskParams: COMMON_RISK,
  stockCodes: TRACK_B_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(vbResult);
saveLabResult(writeDb, vbResult);

// 5. MA Crossover
console.log('\n▶ MA Crossover (default params)');
const maResult = runLabBacktest(db, {
  algorithmId: 'TRACK_B_MA',
  strategyType: STRATEGY_TYPE.MA_CROSSOVER,
  name: 'MA Crossover Default',
  params: { shortPeriod: 5, longPeriod: 20 },
  riskParams: COMMON_RISK,
  stockCodes: TRACK_B_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(maResult);
saveLabResult(writeDb, maResult);

console.log('\n═══════════════════════════════════════════════════════');
console.log(' Step 2: Parameter Sweep');
console.log('═══════════════════════════════════════════════════════\n');

// ── Step 2: Parameter Sweep ──

// Turtle Sweep
console.log('▶ Turtle Parameter Sweep');
const turtleSweep = runSweep(db, {
  baseConfig: {
    algorithmId: 'TRACK_B_TURTLE_SWEEP',
    strategyType: STRATEGY_TYPE.TURTLE,
    name: 'Turtle Sweep',
    riskParams: COMMON_RISK,
    stockCodes: TRACK_B_UNIVERSE,
    startDate: START_DATE,
    endDate: END_DATE,
    initialCapital: INITIAL_CAPITAL
  },
  paramGrid: {
    entryPeriod: [20, 40, 55],
    exitPeriod: [10, 20],
    atrPeriod: [14, 20]
  }
});
console.log(`  Total combos: ${turtleSweep.results.length}`);
console.log('  Top 5:');
printSweepTop(turtleSweep);
for (const r of turtleSweep.results) saveLabResult(writeDb, r);

// Volatility Breakout Sweep
console.log('\n▶ Volatility Breakout Parameter Sweep');
const vbSweep = runSweep(db, {
  baseConfig: {
    algorithmId: 'TRACK_B_VB_SWEEP',
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    name: 'VB Sweep',
    riskParams: COMMON_RISK,
    stockCodes: TRACK_B_UNIVERSE,
    startDate: START_DATE,
    endDate: END_DATE,
    initialCapital: INITIAL_CAPITAL
  },
  paramGrid: {
    k: [0.3, 0.5, 0.7],
    shortMaPeriod: [5, 10],
    longMaPeriod: [20, 40],
    rsiPeriod: [14],
    rsiLow: [30],
    rsiHigh: [70]
  }
});
console.log(`  Total combos: ${vbSweep.results.length}`);
console.log('  Top 5:');
printSweepTop(vbSweep);
for (const r of vbSweep.results) saveLabResult(writeDb, r);

// MA Crossover Sweep (baseline comparison)
console.log('\n▶ MA Crossover Parameter Sweep (baseline)');
const maSweep = runSweep(db, {
  baseConfig: {
    algorithmId: 'TRACK_B_MA_SWEEP',
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    name: 'MA Crossover Sweep',
    riskParams: COMMON_RISK,
    stockCodes: TRACK_B_UNIVERSE,
    startDate: START_DATE,
    endDate: END_DATE,
    initialCapital: INITIAL_CAPITAL
  },
  paramGrid: {
    shortPeriod: [5, 10, 20],
    longPeriod: [20, 40, 60]
  }
});
console.log(`  Total combos: ${maSweep.results.length}`);
console.log('  Top 5:');
printSweepTop(maSweep);
for (const r of maSweep.results) saveLabResult(writeDb, r);

// ── Summary ──
console.log('\n═══════════════════════════════════════════════════════');
console.log(' Summary: Baseline vs Best Sweep');
console.log('═══════════════════════════════════════════════════════');

const bestTurtle = turtleSweep.results[turtleSweep.ranking[0]!]!;
const bestVb = vbSweep.results[vbSweep.ranking[0]!]!;
const bestMa = maSweep.results[maSweep.ranking[0]!]!;

const summary = [
  { name: 'Buy & Hold', r: bhResult },
  { name: 'Equal Weight', r: ewResult },
  { name: 'Turtle (best)', r: bestTurtle },
  { name: 'VB (best)', r: bestVb },
  { name: 'MA Cross (best)', r: bestMa }
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
