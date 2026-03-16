/**
 * Track B: 강건성 테스트
 * 채택 후보: VB (k=0.7, 5/20), MA Cross (5/40)
 *
 * 테스트 항목:
 *  1. 비용 2배
 *  2. 슬리피지 2배
 *  3. T+2 체결 지연
 *  4. 유니버스 20% 축소 (상위 24개만)
 *  5. 파라미터 ±1 구간 이동
 *  6. OOS: 앞 70% in-sample, 뒤 30% out-of-sample
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

// ── Universe ──
const FULL_UNIVERSE = [
  '005930',
  '000660',
  '034020',
  '005380',
  '042660',
  '035420',
  '012450',
  '196170',
  '086520',
  '042700',
  '272210',
  '006400',
  '035720',
  '064350',
  '015760',
  '010140',
  '000270',
  '402340',
  '108490',
  '298380',
  '105560',
  '005490',
  '373220',
  '007660',
  '329180',
  '006800',
  '000720',
  '267260',
  '009830',
  '009150'
];
// 유니버스 20% 축소: 상위 24개
const REDUCED_UNIVERSE = FULL_UNIVERSE.slice(0, 24);

const COMMON_RISK: LabRiskParams = {
  stopLossRate: 0.08,
  takeProfitRate: 0.2,
  maxHoldDays: 60,
  maxPositions: 10,
  maxWeight: 0.15
};

const START_DATE = '2025-06-01';
const END_DATE = '2026-03-12';
const INITIAL_CAPITAL = 100_000_000;

// OOS 분할: 전체 거래일 기준 70/30
// 2025-06-02 ~ 2026-03-12 = ~195 거래일, 70% ≈ 136일 → ~2025-12-15 기점
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

function run(
  overrides: Partial<LabBacktestConfig> & {
    costParams?: Partial<LabCostParams>;
  },
  label?: string
): LabBacktestResult {
  const strategyType =
    overrides.strategyType ?? STRATEGY_TYPE.VOLATILITY_BREAKOUT;
  const algoIdMap: Record<string, string> = {
    [STRATEGY_TYPE.VOLATILITY_BREAKOUT]: 'TRACK_B_VB_ROBUST',
    [STRATEGY_TYPE.MA_CROSSOVER]: 'TRACK_B_MA_ROBUST',
    [STRATEGY_TYPE.BUY_AND_HOLD]: 'TRACK_B_BH_ROBUST',
    [STRATEGY_TYPE.EQUAL_WEIGHT]: 'TRACK_B_EW_ROBUST'
  };
  const result = runLabBacktest(db, {
    algorithmId: algoIdMap[strategyType] ?? 'ROBUSTNESS',
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

// ── Main ──
const db = new Database(DB_PATH, { readonly: true });

// ── DB 저장용 (writable) ──
const writeDb = new Database(DB_PATH);
ensureLabSchema(writeDb);

ensureAlgorithm(writeDb, {
  id: 'TRACK_B_VB_ROBUST',
  name: 'VB Robustness',
  strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
  description: 'VB(k=0.7,5/20) 강건성 테스트',
  hypothesis: '비용·슬리피지·지연·유니버스 변동에도 성과가 유지되는가?'
});
ensureAlgorithm(writeDb, {
  id: 'TRACK_B_MA_ROBUST',
  name: 'MA Cross Robustness',
  strategyType: STRATEGY_TYPE.MA_CROSSOVER,
  description: 'MA(5/40) 강건성 테스트',
  hypothesis: '비용·슬리피지·지연·유니버스 변동에도 성과가 유지되는가?'
});
ensureAlgorithm(writeDb, {
  id: 'TRACK_B_BH_ROBUST',
  name: 'B&H Robustness',
  strategyType: STRATEGY_TYPE.BUY_AND_HOLD,
  description: '벤치마크 강건성 비교',
  hypothesis: 'OOS 구간 벤치마크 비교'
});
ensureAlgorithm(writeDb, {
  id: 'TRACK_B_EW_ROBUST',
  name: 'EW Robustness',
  strategyType: STRATEGY_TYPE.EQUAL_WEIGHT,
  description: '벤치마크 강건성 비교',
  hypothesis: 'OOS 구간 벤치마크 비교'
});

console.log(
  '═══════════════════════════════════════════════════════════════════════'
);
console.log(' Track B 강건성 테스트');
console.log(
  '═══════════════════════════════════════════════════════════════════════\n'
);

// ── 1. Volatility Breakout (k=0.7, short=5, long=20) ──
console.log('▶ Volatility Breakout (k=0.7, 5/20)');
header();

const VB_PARAMS = {
  k: 0.7,
  shortMaPeriod: 5,
  longMaPeriod: 20,
  rsiPeriod: 14,
  rsiLow: 30,
  rsiHigh: 70
};

const vbBase = run(
  { strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT, params: VB_PARAMS },
  'VB baseline'
);
printRow('기준 (baseline)', vbBase);

const vbCost2x = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: VB_PARAMS,
    costParams: { feeRate: 0.0003, taxRate: 0.0036 }
  },
  'VB 비용2x'
);
printRow('비용 2배', vbCost2x);

const vbSlip2x = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: VB_PARAMS,
    costParams: { slippageRate: 0.002 }
  },
  'VB 슬리피지2x'
);
printRow('슬리피지 2배', vbSlip2x);

const vbDelay = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: VB_PARAMS,
    executionDelay: 2
  },
  'VB T+2'
);
printRow('T+2 체결 지연', vbDelay);

const vbVwap = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: VB_PARAMS,
    executionPrice: 'vwap'
  },
  'VB VWAP'
);
printRow('VWAP 체결', vbVwap);

const vbReduced = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: VB_PARAMS,
    stockCodes: REDUCED_UNIVERSE
  },
  'VB 유니버스축소'
);
printRow('유니버스 20% 축소', vbReduced);

// 파라미터 ±1 이동
const vbParamUp = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: { ...VB_PARAMS, k: 0.8 }
  },
  'VB k=0.8'
);
printRow('k +0.1 (0.8)', vbParamUp);

const vbParamDown = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: { ...VB_PARAMS, k: 0.6 }
  },
  'VB k=0.6'
);
printRow('k -0.1 (0.6)', vbParamDown);

const vbParamLong = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: { ...VB_PARAMS, longMaPeriod: 25 }
  },
  'VB longMA=25'
);
printRow('longMA +5 (25)', vbParamLong);

const vbParamLongDown = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: { ...VB_PARAMS, longMaPeriod: 15 }
  },
  'VB longMA=15'
);
printRow('longMA -5 (15)', vbParamLongDown);

// OOS
const vbIS = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: VB_PARAMS,
    endDate: OOS_SPLIT_DATE
  },
  'VB IS'
);
printRow('IS (6/1~12/15)', vbIS);

const vbOOS = run(
  {
    strategyType: STRATEGY_TYPE.VOLATILITY_BREAKOUT,
    params: VB_PARAMS,
    startDate: OOS_SPLIT_DATE
  },
  'VB OOS'
);
printRow('OOS (12/15~3/12)', vbOOS);

// ── 2. MA Crossover (5/40) ──
console.log('\n\n▶ MA Crossover (5/40)');
header();

const MA_PARAMS = { shortPeriod: 5, longPeriod: 40 };

const maBase = run(
  { strategyType: STRATEGY_TYPE.MA_CROSSOVER, params: MA_PARAMS },
  'MA baseline'
);
printRow('기준 (baseline)', maBase);

const maCost2x = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: MA_PARAMS,
    costParams: { feeRate: 0.0003, taxRate: 0.0036 }
  },
  'MA 비용2x'
);
printRow('비용 2배', maCost2x);

const maSlip2x = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: MA_PARAMS,
    costParams: { slippageRate: 0.002 }
  },
  'MA 슬리피지2x'
);
printRow('슬리피지 2배', maSlip2x);

const maDelay = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: MA_PARAMS,
    executionDelay: 2
  },
  'MA T+2'
);
printRow('T+2 체결 지연', maDelay);

const maVwap = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: MA_PARAMS,
    executionPrice: 'vwap'
  },
  'MA VWAP'
);
printRow('VWAP 체결', maVwap);

const maReduced = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: MA_PARAMS,
    stockCodes: REDUCED_UNIVERSE
  },
  'MA 유니버스축소'
);
printRow('유니버스 20% 축소', maReduced);

// 파라미터 ±1 이동
const maParamShortUp = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: { shortPeriod: 7, longPeriod: 40 }
  },
  'MA 7/40'
);
printRow('short +2 (7/40)', maParamShortUp);

const maParamShortDown = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: { shortPeriod: 3, longPeriod: 40 }
  },
  'MA 3/40'
);
printRow('short -2 (3/40)', maParamShortDown);

const maParamLongUp = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: { shortPeriod: 5, longPeriod: 45 }
  },
  'MA 5/45'
);
printRow('long +5 (5/45)', maParamLongUp);

const maParamLongDown = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: { shortPeriod: 5, longPeriod: 35 }
  },
  'MA 5/35'
);
printRow('long -5 (5/35)', maParamLongDown);

// OOS
const maIS = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: MA_PARAMS,
    endDate: OOS_SPLIT_DATE
  },
  'MA IS'
);
printRow('IS (6/1~12/15)', maIS);

const maOOS = run(
  {
    strategyType: STRATEGY_TYPE.MA_CROSSOVER,
    params: MA_PARAMS,
    startDate: OOS_SPLIT_DATE
  },
  'MA OOS'
);
printRow('OOS (12/15~3/12)', maOOS);

// ── 3. 벤치마크 비교 (같은 구간) ──
console.log('\n\n▶ 벤치마크 (참고)');
header();

const bhRisk: LabRiskParams = {
  stopLossRate: 1,
  takeProfitRate: 100,
  maxHoldDays: 9999,
  maxPositions: 30,
  maxWeight: 0.05
};

const bh = run(
  { strategyType: STRATEGY_TYPE.BUY_AND_HOLD, params: {}, riskParams: bhRisk },
  'B&H full'
);
printRow('Buy & Hold', bh);

const ew = run(
  {
    strategyType: STRATEGY_TYPE.EQUAL_WEIGHT,
    params: { rebalanceDays: 20 },
    riskParams: bhRisk
  },
  'EW full'
);
printRow('Equal Weight', ew);

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

console.log('  VB (k=0.7, 5/20):');
console.log(`    비용 2배:       ${degradation(vbBase, vbCost2x)}`);
console.log(`    슬리피지 2배:   ${degradation(vbBase, vbSlip2x)}`);
console.log(`    T+2 지연:       ${degradation(vbBase, vbDelay)}`);
console.log(`    VWAP 체결:      ${degradation(vbBase, vbVwap)}`);
console.log(`    유니버스 축소:   ${degradation(vbBase, vbReduced)}`);
console.log(`    IS 수익:        ${fmt(vbIS.totalReturn, true)}`);
console.log(`    OOS 수익:       ${fmt(vbOOS.totalReturn, true)}`);

console.log('\n  MA Cross (5/40):');
console.log(`    비용 2배:       ${degradation(maBase, maCost2x)}`);
console.log(`    슬리피지 2배:   ${degradation(maBase, maSlip2x)}`);
console.log(`    T+2 지연:       ${degradation(maBase, maDelay)}`);
console.log(`    VWAP 체결:      ${degradation(maBase, maVwap)}`);
console.log(`    유니버스 축소:   ${degradation(maBase, maReduced)}`);
console.log(`    IS 수익:        ${fmt(maIS.totalReturn, true)}`);
console.log(`    OOS 수익:       ${fmt(maOOS.totalReturn, true)}`);

console.log('\n  벤치마크:');
console.log(`    B&H IS:         ${fmt(bhIS.totalReturn, true)}`);
console.log(`    B&H OOS:        ${fmt(bhOOS.totalReturn, true)}`);

db.close();
writeDb.close();
console.log('\nDone.');
