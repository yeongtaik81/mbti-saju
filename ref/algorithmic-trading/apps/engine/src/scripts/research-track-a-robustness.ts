/**
 * Track A: ETF 듀얼 모멘텀 강건성 테스트
 * 채택 후보:
 *   DM1: lookback=60, holdDays=30, topN=5 (최고 수익)
 *   DM2: lookback=80, holdDays=30, topN=5 (최저 MDD)
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLabBacktest } from '../strategy/lab/run-lab-backtest.js';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/trading.db');

const FULL_UNIVERSE = [
  '069500',
  '229200',
  '360750',
  '371460',
  '395160',
  '305720',
  '132030',
  '364690',
  '379800',
  '161510'
];
const REDUCED_UNIVERSE = FULL_UNIVERSE.slice(0, 8); // 20% 축소

const COMMON_RISK: LabRiskParams = {
  stopLossRate: 0.15,
  takeProfitRate: 0.5,
  maxHoldDays: 60,
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

const db = new Database(DB_PATH, { readonly: true });
const writeDb = new Database(DB_PATH);
ensureLabSchema(writeDb);

ensureAlgorithm(writeDb, {
  id: 'TRACK_A_DM1_ROBUST',
  name: 'DM1 Robustness (60/30/5)',
  strategyType: STRATEGY_TYPE.DUAL_MOMENTUM,
  description: 'DM lookback=60,holdDays=30,topN=5 강건성',
  hypothesis: '비용·슬리피지·지연·VWAP·유니버스 변동에도 성과 유지?'
});
ensureAlgorithm(writeDb, {
  id: 'TRACK_A_DM2_ROBUST',
  name: 'DM2 Robustness (80/30/5)',
  strategyType: STRATEGY_TYPE.DUAL_MOMENTUM,
  description: 'DM lookback=80,holdDays=30,topN=5 강건성',
  hypothesis: '낮은 MDD 유지하면서 비용·지연에도 성과 유지?'
});
ensureAlgorithm(writeDb, {
  id: 'TRACK_A_BH_ROBUST',
  name: 'ETF B&H Robustness',
  strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
  description: 'ETF 벤치마크 강건성',
  hypothesis: 'OOS 벤치마크 비교'
});

function run(
  overrides: Partial<LabBacktestConfig> & {
    costParams?: Partial<LabCostParams>;
  },
  label?: string
): LabBacktestResult {
  const strategyType = overrides.strategyType ?? STRATEGY_TYPE.DUAL_MOMENTUM;
  const algoIdMap: Record<string, string> = {
    [STRATEGY_TYPE.DUAL_MOMENTUM]:
      overrides.algorithmId ?? 'TRACK_A_DM1_ROBUST',
    [STRATEGY_TYPE.BUY_AND_HOLD]: 'TRACK_A_BH_ROBUST'
  };
  const result = runLabBacktest(db, {
    algorithmId: algoIdMap[strategyType] ?? 'TRACK_A_DM1_ROBUST',
    strategyType,
    name: label ?? 'test',
    params: {},
    riskParams: COMMON_RISK,
    stockCodes: FULL_UNIVERSE,
    startDate: START_DATE,
    endDate: END_DATE,
    initialCapital: INITIAL_CAPITAL,
    ...overrides
  });
  saveLabResult(writeDb, result);
  return result;
}

console.log(
  '═══════════════════════════════════════════════════════════════════════'
);
console.log(' Track A: ETF 듀얼 모멘텀 강건성 테스트');
console.log(
  '═══════════════════════════════════════════════════════════════════════\n'
);

// ── DM1: lookback=60, holdDays=30, topN=5 ──
console.log('▶ DM1 (lookback=60, holdDays=30, topN=5)');
header();

const DM1_PARAMS = { lookback: 60, holdDays: 30, topN: 5 };

const dm1Base = run(
  { algorithmId: 'TRACK_A_DM1_ROBUST', params: DM1_PARAMS },
  'DM1 baseline'
);
printRow('기준 (baseline)', dm1Base);

const dm1Cost2x = run(
  {
    algorithmId: 'TRACK_A_DM1_ROBUST',
    params: DM1_PARAMS,
    costParams: { feeRate: 0.0003, taxRate: 0.0036 }
  },
  'DM1 비용2x'
);
printRow('비용 2배', dm1Cost2x);

const dm1Slip2x = run(
  {
    algorithmId: 'TRACK_A_DM1_ROBUST',
    params: DM1_PARAMS,
    costParams: { slippageRate: 0.002 }
  },
  'DM1 슬리피지2x'
);
printRow('슬리피지 2배', dm1Slip2x);

const dm1Delay = run(
  { algorithmId: 'TRACK_A_DM1_ROBUST', params: DM1_PARAMS, executionDelay: 2 },
  'DM1 T+2'
);
printRow('T+2 체결 지연', dm1Delay);

const dm1Vwap = run(
  {
    algorithmId: 'TRACK_A_DM1_ROBUST',
    params: DM1_PARAMS,
    executionPrice: 'vwap'
  },
  'DM1 VWAP'
);
printRow('VWAP 체결', dm1Vwap);

const dm1Reduced = run(
  {
    algorithmId: 'TRACK_A_DM1_ROBUST',
    params: DM1_PARAMS,
    stockCodes: REDUCED_UNIVERSE
  },
  'DM1 유니버스축소'
);
printRow('유니버스 20% 축소', dm1Reduced);

// 파라미터 이동
const dm1LookUp = run(
  {
    algorithmId: 'TRACK_A_DM1_ROBUST',
    params: { ...DM1_PARAMS, lookback: 70 }
  },
  'DM1 lookback=70'
);
printRow('lookback +10 (70)', dm1LookUp);

const dm1LookDown = run(
  {
    algorithmId: 'TRACK_A_DM1_ROBUST',
    params: { ...DM1_PARAMS, lookback: 50 }
  },
  'DM1 lookback=50'
);
printRow('lookback -10 (50)', dm1LookDown);

const dm1TopDown = run(
  { algorithmId: 'TRACK_A_DM1_ROBUST', params: { ...DM1_PARAMS, topN: 3 } },
  'DM1 topN=3'
);
printRow('topN 3', dm1TopDown);

// OOS
const dm1IS = run(
  {
    algorithmId: 'TRACK_A_DM1_ROBUST',
    params: DM1_PARAMS,
    endDate: OOS_SPLIT_DATE
  },
  'DM1 IS'
);
printRow('IS (6/1~12/15)', dm1IS);

const dm1OOS = run(
  {
    algorithmId: 'TRACK_A_DM1_ROBUST',
    params: DM1_PARAMS,
    startDate: OOS_SPLIT_DATE
  },
  'DM1 OOS'
);
printRow('OOS (12/15~3/12)', dm1OOS);

// ── DM2: lookback=80, holdDays=30, topN=5 ──
console.log('\n\n▶ DM2 (lookback=80, holdDays=30, topN=5)');
header();

const DM2_PARAMS = { lookback: 80, holdDays: 30, topN: 5 };

const dm2Base = run(
  { algorithmId: 'TRACK_A_DM2_ROBUST', params: DM2_PARAMS },
  'DM2 baseline'
);
printRow('기준 (baseline)', dm2Base);

const dm2Cost2x = run(
  {
    algorithmId: 'TRACK_A_DM2_ROBUST',
    params: DM2_PARAMS,
    costParams: { feeRate: 0.0003, taxRate: 0.0036 }
  },
  'DM2 비용2x'
);
printRow('비용 2배', dm2Cost2x);

const dm2Slip2x = run(
  {
    algorithmId: 'TRACK_A_DM2_ROBUST',
    params: DM2_PARAMS,
    costParams: { slippageRate: 0.002 }
  },
  'DM2 슬리피지2x'
);
printRow('슬리피지 2배', dm2Slip2x);

const dm2Delay = run(
  { algorithmId: 'TRACK_A_DM2_ROBUST', params: DM2_PARAMS, executionDelay: 2 },
  'DM2 T+2'
);
printRow('T+2 체결 지연', dm2Delay);

const dm2Vwap = run(
  {
    algorithmId: 'TRACK_A_DM2_ROBUST',
    params: DM2_PARAMS,
    executionPrice: 'vwap'
  },
  'DM2 VWAP'
);
printRow('VWAP 체결', dm2Vwap);

const dm2Reduced = run(
  {
    algorithmId: 'TRACK_A_DM2_ROBUST',
    params: DM2_PARAMS,
    stockCodes: REDUCED_UNIVERSE
  },
  'DM2 유니버스축소'
);
printRow('유니버스 20% 축소', dm2Reduced);

// 파라미터 이동
const dm2LookUp = run(
  {
    algorithmId: 'TRACK_A_DM2_ROBUST',
    params: { ...DM2_PARAMS, lookback: 90 }
  },
  'DM2 lookback=90'
);
printRow('lookback +10 (90)', dm2LookUp);

const dm2LookDown = run(
  {
    algorithmId: 'TRACK_A_DM2_ROBUST',
    params: { ...DM2_PARAMS, lookback: 70 }
  },
  'DM2 lookback=70'
);
printRow('lookback -10 (70)', dm2LookDown);

const dm2TopDown = run(
  { algorithmId: 'TRACK_A_DM2_ROBUST', params: { ...DM2_PARAMS, topN: 3 } },
  'DM2 topN=3'
);
printRow('topN 3', dm2TopDown);

// OOS
const dm2IS = run(
  {
    algorithmId: 'TRACK_A_DM2_ROBUST',
    params: DM2_PARAMS,
    endDate: OOS_SPLIT_DATE
  },
  'DM2 IS'
);
printRow('IS (6/1~12/15)', dm2IS);

const dm2OOS = run(
  {
    algorithmId: 'TRACK_A_DM2_ROBUST',
    params: DM2_PARAMS,
    startDate: OOS_SPLIT_DATE
  },
  'DM2 OOS'
);
printRow('OOS (12/15~3/12)', dm2OOS);

// ── 벤치마크 ──
console.log('\n\n▶ 벤치마크 (참고)');
header();

const bhRisk: LabRiskParams = {
  stopLossRate: 1,
  takeProfitRate: 100,
  maxHoldDays: 9999,
  maxPositions: 10,
  maxWeight: 0.12
};

const bhIS = run(
  {
    strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
    params: {},
    riskParams: bhRisk,
    endDate: OOS_SPLIT_DATE
  },
  'B&H IS'
);
printRow('B&H IS (6/1~12/15)', bhIS);

const bhOOS = run(
  {
    strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
    params: {},
    riskParams: bhRisk,
    startDate: OOS_SPLIT_DATE
  },
  'B&H OOS'
);
printRow('B&H OOS (12/15~3/12)', bhOOS);

// ── 요약 ──
console.log(
  '\n═══════════════════════════════════════════════════════════════════════'
);
console.log(' 강건성 판정 요약');
console.log(
  '═══════════════════════════════════════════════════════════════════════\n'
);

function degradation(base: LabBacktestResult, test: LabBacktestResult): string {
  const retDrop = (
    ((test.totalReturn - base.totalReturn) / Math.abs(base.totalReturn)) *
    100
  ).toFixed(1);
  const mddChange = ((test.mdd - base.mdd) * 100).toFixed(2);
  return `수익 ${retDrop}%, MDD변화 ${mddChange}%p`;
}

console.log('  DM1 (60/30/5):');
console.log(`    비용 2배:       ${degradation(dm1Base, dm1Cost2x)}`);
console.log(`    슬리피지 2배:   ${degradation(dm1Base, dm1Slip2x)}`);
console.log(`    T+2 지연:       ${degradation(dm1Base, dm1Delay)}`);
console.log(`    VWAP 체결:      ${degradation(dm1Base, dm1Vwap)}`);
console.log(`    유니버스 축소:   ${degradation(dm1Base, dm1Reduced)}`);
console.log(`    IS 수익:        ${fmt(dm1IS.totalReturn, true)}`);
console.log(`    OOS 수익:       ${fmt(dm1OOS.totalReturn, true)}`);

console.log('\n  DM2 (80/30/5):');
console.log(`    비용 2배:       ${degradation(dm2Base, dm2Cost2x)}`);
console.log(`    슬리피지 2배:   ${degradation(dm2Base, dm2Slip2x)}`);
console.log(`    T+2 지연:       ${degradation(dm2Base, dm2Delay)}`);
console.log(`    VWAP 체결:      ${degradation(dm2Base, dm2Vwap)}`);
console.log(`    유니버스 축소:   ${degradation(dm2Base, dm2Reduced)}`);
console.log(`    IS 수익:        ${fmt(dm2IS.totalReturn, true)}`);
console.log(`    OOS 수익:       ${fmt(dm2OOS.totalReturn, true)}`);

console.log('\n  벤치마크:');
console.log(`    B&H IS:         ${fmt(bhIS.totalReturn, true)}`);
console.log(`    B&H OOS:        ${fmt(bhOOS.totalReturn, true)}`);

db.close();
writeDb.close();
console.log('\nDone.');
