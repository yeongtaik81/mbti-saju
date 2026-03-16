/**
 * Track C: ETF 평균회귀 연구
 * Step 8: Baseline (bb_rsi, buy_and_hold, equal_weight)
 * Step 9: Parameter sweep + 강건성 + OOS
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
  LabRiskParams,
  LabCostParams
} from '../strategy/lab/types.js';
import type { SweepResult } from '../strategy/lab/sweep.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/trading.db');

// ── Track C Universe: 대형 지수/섹터 ETF (변동성이 지나치게 큰 테마 ETF 제외) ──
const TRACK_C_UNIVERSE = [
  '069500', // KODEX 200
  '229200', // KODEX 코스닥150
  '360750', // TIGER 미국S&P500
  '371460', // TIGER 미국나스닥100
  '161510', // ARIRANG 고배당주
  '148020' // KBSTAR 200
];

const COMMON_RISK: LabRiskParams = {
  stopLossRate: 0.08,
  takeProfitRate: 0.15, // 평균회귀는 작은 익절
  maxHoldDays: 30, // 단기 보유
  maxPositions: 5,
  maxWeight: 0.25
};

const START_DATE = '2025-06-01';
const END_DATE = '2026-03-12';
const INITIAL_CAPITAL = 100_000_000;
const OOS_SPLIT_DATE = '2025-12-15';

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

function printRow(label: string, r: LabBacktestResult): void {
  console.log(
    `  ${label.padEnd(28)}| ${fmt(r.totalReturn, true).padStart(8)} | ${fmt(r.mdd, true).padStart(8)} | ${fmt(r.sharpeRatio).padStart(6)} | ${fmt(r.winRate, true).padStart(8)} | ${fmt(r.profitFactor).padStart(5)} | ${String(r.totalTrades).padStart(6)}`
  );
}

function header(): void {
  console.log(
    `  ${'Test'.padEnd(28)}| ${'Return'.padStart(8)} | ${'MDD'.padStart(8)} | ${'Sharpe'.padStart(6)} | ${'WinRate'.padStart(8)} | ${'PF'.padStart(5)} | ${'Trades'.padStart(6)}`
  );
  console.log(
    `  ${'─'.repeat(28)}|${'─'.repeat(10)}|${'─'.repeat(10)}|${'─'.repeat(8)}|${'─'.repeat(10)}|${'─'.repeat(7)}|${'─'.repeat(8)}`
  );
}

// ── Main ──
const db = new Database(DB_PATH, { readonly: true });
const writeDb = new Database(DB_PATH);
ensureLabSchema(writeDb);

const algorithms = [
  {
    id: 'TRACK_C_BH',
    name: 'ETF B&H (MR universe)',
    strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
    description: 'ETF 6종 B&H',
    hypothesis: 'Benchmark'
  },
  {
    id: 'TRACK_C_EW',
    name: 'ETF EW (MR universe)',
    strategyType: STRATEGY_TYPE.EQUAL_WEIGHT,
    description: 'ETF 6종 EW',
    hypothesis: 'Benchmark'
  },
  {
    id: 'TRACK_C_BBRSI',
    name: 'BB+RSI Default',
    strategyType: STRATEGY_TYPE.BB_RSI,
    description: 'BB+RSI 기본 파라미터',
    hypothesis: 'ETF에서 BB+RSI 평균회귀가 유효한가?'
  },
  {
    id: 'TRACK_C_BBRSI_SWEEP',
    name: 'BB+RSI Sweep',
    strategyType: STRATEGY_TYPE.BB_RSI,
    description: 'BB+RSI 파라미터 스윕',
    hypothesis: '최적 BB/RSI 파라미터 탐색'
  },
  {
    id: 'TRACK_C_BBRSI_ROBUST',
    name: 'BB+RSI Robustness',
    strategyType: STRATEGY_TYPE.BB_RSI,
    description: 'BB+RSI 강건성 테스트',
    hypothesis: '비용/지연/VWAP에도 성과 유지?'
  },
  {
    id: 'TRACK_C_BH_ROBUST',
    name: 'ETF B&H Robust (MR)',
    strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
    description: '벤치마크 OOS',
    hypothesis: 'OOS 비교용'
  }
];
for (const algo of algorithms) {
  ensureAlgorithm(writeDb, algo);
}

console.log('═══════════════════════════════════════════════════════');
console.log(' Track C: ETF 평균회귀 (BB+RSI) 연구');
console.log(`  Universe: ${TRACK_C_UNIVERSE.length} ETFs`);
console.log(`  Period: ${START_DATE} ~ ${END_DATE}`);
console.log('═══════════════════════════════════════════════════════\n');

// ── Step 8: Baselines ──
console.log('▶ Buy & Hold (benchmark)');
const bhRisk: LabRiskParams = {
  stopLossRate: 1,
  takeProfitRate: 100,
  maxHoldDays: 9999,
  maxPositions: 6,
  maxWeight: 0.2
};
const bhResult = runLabBacktest(db, {
  algorithmId: 'TRACK_C_BH',
  strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
  name: 'B&H Benchmark',
  params: {},
  riskParams: bhRisk,
  stockCodes: TRACK_C_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(bhResult);
saveLabResult(writeDb, bhResult);

console.log('\n▶ Equal Weight (benchmark)');
const ewResult = runLabBacktest(db, {
  algorithmId: 'TRACK_C_EW',
  strategyType: STRATEGY_TYPE.EQUAL_WEIGHT,
  name: 'EW Benchmark',
  params: { rebalanceDays: 20 },
  riskParams: bhRisk,
  stockCodes: TRACK_C_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(ewResult);
saveLabResult(writeDb, ewResult);

console.log(
  '\n▶ BB+RSI (default: bbPeriod=20, bbK=2, rsiPeriod=14, rsiLow=30, rsiHigh=70)'
);
const bbResult = runLabBacktest(db, {
  algorithmId: 'TRACK_C_BBRSI',
  strategyType: STRATEGY_TYPE.BB_RSI,
  name: 'BB+RSI Default',
  params: { bbPeriod: 20, bbK: 2, rsiPeriod: 14, rsiLow: 30, rsiHigh: 70 },
  riskParams: COMMON_RISK,
  stockCodes: TRACK_C_UNIVERSE,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
printResult(bbResult);
saveLabResult(writeDb, bbResult);

// ── Step 8: Parameter Sweep ──
console.log('\n═══════════════════════════════════════════════════════');
console.log(' Parameter Sweep');
console.log('═══════════════════════════════════════════════════════\n');

console.log('▶ BB+RSI Parameter Sweep');
const bbSweep = runSweep(db, {
  baseConfig: {
    algorithmId: 'TRACK_C_BBRSI_SWEEP',
    strategyType: STRATEGY_TYPE.BB_RSI,
    name: 'BB+RSI Sweep',
    riskParams: COMMON_RISK,
    stockCodes: TRACK_C_UNIVERSE,
    startDate: START_DATE,
    endDate: END_DATE,
    initialCapital: INITIAL_CAPITAL
  },
  paramGrid: {
    bbPeriod: [20, 30],
    bbK: [2, 2.5],
    rsiPeriod: [7, 14],
    rsiLow: [20, 30],
    rsiHigh: [60, 70]
  }
});
console.log(`  Total combos: ${bbSweep.results.length}`);
console.log('  Top 10:');
printSweepTop(bbSweep, 10);
for (const r of bbSweep.results) saveLabResult(writeDb, r);

// ── Step 9: 강건성 테스트 (상위 1개) ──
const bestIdx = bbSweep.ranking[0]!;
const bestConfig = bbSweep.configs[bestIdx]!;
const bestParams = bestConfig.params;
console.log(`\n═══════════════════════════════════════════════════════`);
console.log(` 강건성 테스트: params=${JSON.stringify(bestParams)}`);
console.log('═══════════════════════════════════════════════════════\n');
header();

function runRobust(
  overrides: Partial<LabBacktestConfig> & {
    costParams?: Partial<LabCostParams>;
  },
  label: string
): LabBacktestResult {
  const result = runLabBacktest(db, {
    algorithmId: 'TRACK_C_BBRSI_ROBUST',
    strategyType: STRATEGY_TYPE.BB_RSI,
    name: label,
    params: bestParams,
    riskParams: COMMON_RISK,
    stockCodes: TRACK_C_UNIVERSE,
    startDate: START_DATE,
    endDate: END_DATE,
    initialCapital: INITIAL_CAPITAL,
    ...overrides
  });
  saveLabResult(writeDb, result);
  return result;
}

const base = runRobust({}, 'BB baseline');
printRow('기준 (baseline)', base);

const cost2x = runRobust(
  { costParams: { feeRate: 0.0003, taxRate: 0.0036 } },
  'BB 비용2x'
);
printRow('비용 2배', cost2x);

const slip2x = runRobust(
  { costParams: { slippageRate: 0.002 } },
  'BB 슬리피지2x'
);
printRow('슬리피지 2배', slip2x);

const delay = runRobust({ executionDelay: 2 }, 'BB T+2');
printRow('T+2 체결 지연', delay);

const vwap = runRobust({ executionPrice: 'vwap' }, 'BB VWAP');
printRow('VWAP 체결', vwap);

const reduced = runRobust(
  { stockCodes: TRACK_C_UNIVERSE.slice(0, 4) },
  'BB 유니버스축소'
);
printRow('유니버스 33% 축소', reduced);

// OOS
const isResult = runRobust({ endDate: OOS_SPLIT_DATE }, 'BB IS');
printRow('IS (6/1~12/15)', isResult);

const oosResult = runRobust({ startDate: OOS_SPLIT_DATE }, 'BB OOS');
printRow('OOS (12/15~3/12)', oosResult);

// 벤치마크 OOS
const bhIS = runLabBacktest(db, {
  algorithmId: 'TRACK_C_BH_ROBUST',
  strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
  name: 'B&H IS',
  params: {},
  riskParams: bhRisk,
  stockCodes: TRACK_C_UNIVERSE,
  startDate: START_DATE,
  endDate: OOS_SPLIT_DATE,
  initialCapital: INITIAL_CAPITAL
});
saveLabResult(writeDb, bhIS);

const bhOOS = runLabBacktest(db, {
  algorithmId: 'TRACK_C_BH_ROBUST',
  strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
  name: 'B&H OOS',
  params: {},
  riskParams: bhRisk,
  stockCodes: TRACK_C_UNIVERSE,
  startDate: OOS_SPLIT_DATE,
  endDate: END_DATE,
  initialCapital: INITIAL_CAPITAL
});
saveLabResult(writeDb, bhOOS);

printRow('B&H IS', bhIS);
printRow('B&H OOS', bhOOS);

// ── 요약 ──
console.log('\n═══════════════════════════════════════════════════════');
console.log(' 판정 요약');
console.log('═══════════════════════════════════════════════════════\n');

function degradation(b: LabBacktestResult, t: LabBacktestResult): string {
  const retDrop =
    b.totalReturn !== 0
      ? (
          ((t.totalReturn - b.totalReturn) / Math.abs(b.totalReturn)) *
          100
        ).toFixed(1)
      : 'N/A';
  const mddChange = ((t.mdd - b.mdd) * 100).toFixed(2);
  return `수익 ${retDrop}%, MDD변화 ${mddChange}%p`;
}

console.log(`  BB+RSI Best (${JSON.stringify(bestParams)}):`);
console.log(`    비용 2배:       ${degradation(base, cost2x)}`);
console.log(`    슬리피지 2배:   ${degradation(base, slip2x)}`);
console.log(`    T+2 지연:       ${degradation(base, delay)}`);
console.log(`    VWAP 체결:      ${degradation(base, vwap)}`);
console.log(`    유니버스 축소:   ${degradation(base, reduced)}`);
console.log(`    IS 수익:        ${fmt(isResult.totalReturn, true)}`);
console.log(`    OOS 수익:       ${fmt(oosResult.totalReturn, true)}`);
console.log(`    B&H IS:         ${fmt(bhIS.totalReturn, true)}`);
console.log(`    B&H OOS:        ${fmt(bhOOS.totalReturn, true)}`);

db.close();
writeDb.close();
console.log('\nDone.');
