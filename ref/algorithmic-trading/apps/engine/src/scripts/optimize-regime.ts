/**
 * 시장 국면(상승/하락) 분기 전략 최적화
 *
 * 전일까지 데이터로 시장 국면 판단 → 국면별 다른 파라미터 적용 → 최적 조합 탐색
 *
 * 사용법:
 *   pnpm --filter @trading/engine optimize:regime
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

// ── 시장 국면 판단 방법 ──
// "전일까지" 50종목 중 종가 > 20일 MA인 비율 (breadth)
// breadth >= threshold → 상승장, < threshold → 하락장

const MA_PERIOD_FOR_REGIME = 20;
const SLIPPAGE = 0.001;
const FEE_RATE = 0.00015; // 매수 수수료율 (간이)
const TAX_RATE = 0.0018; // 매도 세금 (간이)

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

console.log(`=== 시장 국면별 전략 최적화 ===`);
console.log(`종목: ${stockCodes.length}개, 거래일: ${allDates.length}일`);
console.log(`기간: ${allDates[0]} ~ ${allDates[allDates.length - 1]}\n`);

// ── 종목별 일봉 + 지표 사전 계산 ──
interface StockData {
  candles: Candle[];
  dateIndex: Map<string, number>; // date → index
}

const stockDataMap = new Map<string, StockData>();

for (const code of stockCodes) {
  const candles = db
    .prepare(
      `SELECT stock_code AS stockCode, date, open, high, low, close, adj_close AS adjClose, volume, amount
     FROM daily_candles WHERE stock_code = ? ORDER BY date ASC`
    )
    .all(code) as Candle[];

  const dateIndex = new Map<string, number>();
  candles.forEach((c, i) => dateIndex.set(c.date, i));
  stockDataMap.set(code, { candles, dateIndex });
}

// ── 일별 시장 breadth 계산 ──
// 각 거래일에 대해: 50종목 중 종가 > MA20인 비율
const dailyBreadth = new Map<string, number>();

for (const date of allDates) {
  let above = 0;
  let total = 0;

  for (const code of stockCodes) {
    const sd = stockDataMap.get(code)!;
    const idx = sd.dateIndex.get(date);
    if (idx === undefined || idx < MA_PERIOD_FOR_REGIME) continue;

    // MA20 계산 (직접 계산, 효율)
    let sum = 0;
    for (let j = idx - MA_PERIOD_FOR_REGIME + 1; j <= idx; j++) {
      sum += sd.candles[j]!.close;
    }
    const ma20 = sum / MA_PERIOD_FOR_REGIME;

    total++;
    if (sd.candles[idx]!.close > ma20) above++;
  }

  dailyBreadth.set(date, total > 0 ? above / total : 0);
}

// ── 매수 신호 + forward return 사전 계산 ──
interface Signal {
  stockCode: string;
  date: string;
  dateIdx: number; // allDates 내 인덱스
  buyPrice: number; // 돌파 가격
  prevBreadth: number; // 전일 breadth (시장 국면 판단용)
  // forward 데이터: 1~10일 후
  forward: { open: number; high: number; low: number; close: number }[];
}

const MAX_HOLD = 10;

function computeSignals(
  k: number,
  shortMa: number,
  longMa: number,
  rsiPeriod: number,
  rsiLow: number,
  rsiHigh: number
): Signal[] {
  const signals: Signal[] = [];
  const lookback = Math.max(longMa, rsiPeriod, 20) + 10;

  for (const code of stockCodes) {
    const sd = stockDataMap.get(code)!;
    const candles = sd.candles;
    if (candles.length < lookback + MAX_HOLD) continue;

    const shortMaVals = sma(candles, shortMa);
    const longMaVals = sma(candles, longMa);
    const rsiVals = rsi(candles, rsiPeriod);

    for (let i = 1; i < candles.length - MAX_HOLD; i++) {
      const prev = candles[i - 1]!;
      const today = candles[i]!;
      const prevRange = prev.high - prev.low;
      if (prevRange <= 0) continue;

      const threshold = today.open + prevRange * k;
      const sm = shortMaVals[i];
      const lm = longMaVals[i];
      const curRsi = rsiVals[i];

      if (sm == null || lm == null || curRsi == null) continue;
      if (today.high < threshold) continue;
      if (!(sm > lm)) continue;
      if (!(curRsi >= rsiLow && curRsi <= rsiHigh)) continue;

      // 전일 breadth
      const dateIdxInAll = allDates.indexOf(today.date);
      if (dateIdxInAll < 1) continue;
      const prevDate = allDates[dateIdxInAll - 1]!;
      const prevBreadth = dailyBreadth.get(prevDate) ?? 0;

      // forward data
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

      signals.push({
        stockCode: code,
        date: today.date,
        dateIdx: dateIdxInAll,
        buyPrice: threshold,
        prevBreadth,
        forward
      });
    }
  }
  return signals;
}

// ── 전략 시뮬레이션 ──
interface StrategyResult {
  label: string;
  regimeThreshold: number;
  bullHoldDays: number;
  bearHoldDays: number;
  bullStopLoss: number;
  bearStopLoss: number;
  bullTakeProfit: number;
  bearTakeProfit: number;
  totalTrades: number;
  bullTrades: number;
  bearTrades: number;
  avgReturn: number;
  medianReturn: number;
  winRate: number;
  profitFactor: number;
  bullAvgReturn: number;
  bearAvgReturn: number;
  bullWinRate: number;
  bearWinRate: number;
}

function simulateStrategy(
  signals: Signal[],
  regimeThreshold: number,
  bullHoldDays: number,
  bearHoldDays: number,
  bullStopLoss: number,
  bearStopLoss: number,
  bullTakeProfit: number,
  bearTakeProfit: number
): StrategyResult {
  const returns: number[] = [];
  const bullReturns: number[] = [];
  const bearReturns: number[] = [];

  for (const sig of signals) {
    const isBull = sig.prevBreadth >= regimeThreshold;
    const holdDays = isBull ? bullHoldDays : bearHoldDays;
    const stopLoss = isBull ? bullStopLoss : bearStopLoss;
    const takeProfit = isBull ? bullTakeProfit : bearTakeProfit;

    // holdDays=0 → 해당 국면에서 매수 안 함
    if (holdDays === 0) continue;

    const buyPrice = sig.buyPrice * (1 + SLIPPAGE);
    let sellPrice = 0;
    let exitDay = holdDays;

    // 보유 기간 중 손절/익절 체크
    for (let d = 0; d < holdDays && d < sig.forward.length; d++) {
      const fd = sig.forward[d]!;

      // 익일 시가에서 손절/익절 체크 (d=0이 익일)
      if (d === 0) {
        // 첫날: 장중 저가/고가로 손절/익절 체크
        if (stopLoss < 0 && fd.low <= buyPrice * (1 + stopLoss)) {
          sellPrice = buyPrice * (1 + stopLoss) * (1 - SLIPPAGE);
          exitDay = d + 1;
          break;
        }
        if (takeProfit > 0 && fd.high >= buyPrice * (1 + takeProfit)) {
          sellPrice = buyPrice * (1 + takeProfit) * (1 - SLIPPAGE);
          exitDay = d + 1;
          break;
        }
      } else {
        // 시가에서 갭 체크
        if (stopLoss < 0 && fd.open <= buyPrice * (1 + stopLoss)) {
          sellPrice = fd.open * (1 - SLIPPAGE);
          exitDay = d + 1;
          break;
        }
        if (takeProfit > 0 && fd.open >= buyPrice * (1 + takeProfit)) {
          sellPrice = fd.open * (1 - SLIPPAGE);
          exitDay = d + 1;
          break;
        }
        // 장중 체크
        if (stopLoss < 0 && fd.low <= buyPrice * (1 + stopLoss)) {
          sellPrice = buyPrice * (1 + stopLoss) * (1 - SLIPPAGE);
          exitDay = d + 1;
          break;
        }
        if (takeProfit > 0 && fd.high >= buyPrice * (1 + takeProfit)) {
          sellPrice = buyPrice * (1 + takeProfit) * (1 - SLIPPAGE);
          exitDay = d + 1;
          break;
        }
      }
    }

    // 시간 청산: holdDays째 시가에 매도
    if (sellPrice === 0) {
      const exitIdx = Math.min(holdDays, sig.forward.length) - 1;
      sellPrice = sig.forward[exitIdx]!.open * (1 - SLIPPAGE);
    }

    // 비용 차감 수익률
    const grossReturn = (sellPrice - buyPrice) / buyPrice;
    const netReturn = grossReturn - FEE_RATE - FEE_RATE - TAX_RATE; // 매수수수료 + 매도수수료 + 세금

    returns.push(netReturn);
    if (isBull) bullReturns.push(netReturn);
    else bearReturns.push(netReturn);
  }

  if (returns.length === 0) {
    return {
      label: '',
      regimeThreshold,
      bullHoldDays,
      bearHoldDays,
      bullStopLoss,
      bearStopLoss,
      bullTakeProfit,
      bearTakeProfit,
      totalTrades: 0,
      bullTrades: 0,
      bearTrades: 0,
      avgReturn: 0,
      medianReturn: 0,
      winRate: 0,
      profitFactor: 0,
      bullAvgReturn: 0,
      bearAvgReturn: 0,
      bullWinRate: 0,
      bearWinRate: 0
    };
  }

  returns.sort((a, b) => a - b);
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const median = returns[Math.floor(returns.length / 2)]!;
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  const winRate = wins.length / returns.length;
  const totalProfit = wins.reduce((s, r) => s + r, 0);
  const totalLoss = Math.abs(losses.reduce((s, r) => s + r, 0));
  const pf =
    totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  const bullAvg =
    bullReturns.length > 0
      ? bullReturns.reduce((s, r) => s + r, 0) / bullReturns.length
      : 0;
  const bearAvg =
    bearReturns.length > 0
      ? bearReturns.reduce((s, r) => s + r, 0) / bearReturns.length
      : 0;
  const bullWin =
    bullReturns.length > 0
      ? bullReturns.filter((r) => r > 0).length / bullReturns.length
      : 0;
  const bearWin =
    bearReturns.length > 0
      ? bearReturns.filter((r) => r > 0).length / bearReturns.length
      : 0;

  return {
    label: '',
    regimeThreshold,
    bullHoldDays,
    bearHoldDays,
    bullStopLoss,
    bearStopLoss,
    bullTakeProfit,
    bearTakeProfit,
    totalTrades: returns.length,
    bullTrades: bullReturns.length,
    bearTrades: bearReturns.length,
    avgReturn: avg,
    medianReturn: median,
    winRate,
    profitFactor: pf,
    bullAvgReturn: bullAvg,
    bearAvgReturn: bearAvg,
    bullWinRate: bullWin,
    bearWinRate: bearWin
  };
}

// ══════════════════════════════════════════
// 메인 실행
// ══════════════════════════════════════════

// 1단계: 기본 파라미터로 신호 생성
console.log('1. 매수 신호 생성 (K=0.5, MA=5/20, RSI=14(30-70))...');
const signals = computeSignals(0.5, 5, 20, 14, 30, 70);
console.log(`   신호 수: ${signals.length}건`);

const bullCount = signals.filter((s) => s.prevBreadth >= 0.5).length;
const bearCount = signals.length - bullCount;
console.log(
  `   상승장 신호: ${bullCount}건, 하락장 신호: ${bearCount}건 (threshold=0.5)\n`
);

// 2단계: Breadth 분포 확인
console.log('2. 매수 신호 시점의 시장 breadth 분포:');
const breadthBuckets = [0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 1.01];
for (let b = 0; b < breadthBuckets.length - 1; b++) {
  const lo = breadthBuckets[b]!;
  const hi = breadthBuckets[b + 1]!;
  const count = signals.filter(
    (s) => s.prevBreadth >= lo && s.prevBreadth < hi
  ).length;
  const avgRet1d = signals
    .filter((s) => s.prevBreadth >= lo && s.prevBreadth < hi)
    .map((s) => (s.forward[0]!.open - s.buyPrice) / s.buyPrice);
  const avg =
    avgRet1d.length > 0
      ? avgRet1d.reduce((s, r) => s + r, 0) / avgRet1d.length
      : 0;
  console.log(
    `   breadth ${(lo * 100).toFixed(0)}~${(hi * 100).toFixed(0)}%: ${count}건 (1일 시가매도 avg: ${(avg * 100).toFixed(2)}%)`
  );
}

// 3단계: 전략 조합 테스트
console.log('\n3. 전략 조합 탐색...\n');

const regimeThresholds = [0.4, 0.5, 0.6];
const holdDayOptions = [0, 1, 2, 3, 5, 7]; // 0 = 매수 안 함
const stopLossOptions = [0, -0.03, -0.05, -0.07]; // 0 = 손절 없음
const takeProfitOptions = [0, 0.03, 0.05, 0.07]; // 0 = 익절 없음

const results: StrategyResult[] = [];
let tested = 0;
const totalCombinations =
  regimeThresholds.length *
  holdDayOptions.length *
  holdDayOptions.length *
  stopLossOptions.length *
  stopLossOptions.length *
  takeProfitOptions.length *
  takeProfitOptions.length;

// 조합이 너무 많으면 줄이기: 손절/익절을 상승/하락 동일하게
const stopLossCombo = stopLossOptions;
const takeProfitCombo = takeProfitOptions;

// 실제 테스트: 상승/하락 보유기간 × 손절/익절은 동일 적용 (현실적 범위)
const reducedTotal =
  regimeThresholds.length *
  holdDayOptions.length *
  holdDayOptions.length *
  stopLossCombo.length *
  takeProfitCombo.length;

console.log(`   탐색 공간: ${reducedTotal}개 조합`);
console.log(`   (국면 threshold × 상승보유 × 하락보유 × 손절 × 익절)\n`);

for (const rt of regimeThresholds) {
  for (const bullHold of holdDayOptions) {
    for (const bearHold of holdDayOptions) {
      for (const sl of stopLossCombo) {
        for (const tp of takeProfitCombo) {
          const result = simulateStrategy(
            signals,
            rt,
            bullHold,
            bearHold,
            sl,
            sl,
            tp,
            tp
          );
          if (result.totalTrades > 0) {
            result.label = `RT=${(rt * 100).toFixed(0)}% B${bullHold}d/H${bearHold}d SL=${sl === 0 ? 'X' : (sl * 100).toFixed(0) + '%'} TP=${tp === 0 ? 'X' : (tp * 100).toFixed(0) + '%'}`;
            results.push(result);
          }
          tested++;
        }
      }
    }
  }
}

console.log(`   테스트 완료: ${tested}개 조합, 유효: ${results.length}개\n`);

// 4단계: 결과 정렬 및 출력
results.sort((a, b) => b.profitFactor - a.profitFactor);

console.log('=== TOP 20 전략 (Profit Factor 순) ===');
console.log('─'.repeat(130));
console.log(
  '순위'.padStart(4),
  '| 전략'.padEnd(42),
  '| 거래수'.padEnd(8),
  '| 평균수익'.padEnd(10),
  '| 중앙값'.padEnd(9),
  '| 승률'.padEnd(8),
  '| PF'.padEnd(7),
  '| 상승수익'.padEnd(10),
  '| 하락수익'.padEnd(10),
  '| 상승승률'.padEnd(9),
  '| 하락승률'
);
console.log('─'.repeat(130));

for (let i = 0; i < Math.min(20, results.length); i++) {
  const r = results[i]!;
  console.log(
    `${i + 1}`.padStart(4),
    `| ${r.label}`.padEnd(42),
    `| ${r.totalTrades}`.padEnd(8),
    `| ${(r.avgReturn * 100).toFixed(2)}%`.padEnd(10),
    `| ${(r.medianReturn * 100).toFixed(2)}%`.padEnd(9),
    `| ${(r.winRate * 100).toFixed(1)}%`.padEnd(8),
    `| ${r.profitFactor.toFixed(2)}`.padEnd(7),
    `| ${(r.bullAvgReturn * 100).toFixed(2)}%`.padEnd(10),
    `| ${(r.bearAvgReturn * 100).toFixed(2)}%`.padEnd(10),
    `| ${(r.bullWinRate * 100).toFixed(1)}%`.padEnd(9),
    `| ${(r.bearWinRate * 100).toFixed(1)}%`
  );
}

// 5단계: 국면 분기 효과 비교
console.log('\n=== 국면 분기 효과 비교 ===');
console.log('(동일 파라미터를 국면 무관하게 적용 vs 국면별 분기)\n');

// Baseline: 국면 무관 7일 보유
const baseline7 = simulateStrategy(
  signals,
  0.5,
  7,
  7,
  -0.05,
  -0.05,
  0.05,
  0.05
);
console.log(`[기준] 7일 보유 (국면 무관, SL=-5%, TP=+5%)`);
console.log(
  `  거래: ${baseline7.totalTrades}건, 수익: ${(baseline7.avgReturn * 100).toFixed(2)}%, 승률: ${(baseline7.winRate * 100).toFixed(1)}%, PF: ${baseline7.profitFactor.toFixed(2)}`
);
console.log(
  `  상승장: ${(baseline7.bullAvgReturn * 100).toFixed(2)}% (${baseline7.bullTrades}건) | 하락장: ${(baseline7.bearAvgReturn * 100).toFixed(2)}% (${baseline7.bearTrades}건)`
);

// Best regime strategy
if (results.length > 0) {
  const best = results[0]!;
  console.log(`\n[최적] ${best.label}`);
  console.log(
    `  거래: ${best.totalTrades}건, 수익: ${(best.avgReturn * 100).toFixed(2)}%, 승률: ${(best.winRate * 100).toFixed(1)}%, PF: ${best.profitFactor.toFixed(2)}`
  );
  console.log(
    `  상승장: ${(best.bullAvgReturn * 100).toFixed(2)}% (${best.bullTrades}건) | 하락장: ${(best.bearAvgReturn * 100).toFixed(2)}% (${best.bearTrades}건)`
  );
}

// 6단계: 하락장 전략 비교
console.log('\n=== 하락장(breadth<50%) 전략 비교 ===');
const bearStrategies = [
  { label: '매수 안 함 (현금 보유)', hold: 0, sl: 0, tp: 0 },
  { label: '1일 보유, 손절 없음', hold: 1, sl: 0, tp: 0 },
  { label: '1일 보유, SL=-3%', hold: 1, sl: -0.03, tp: 0 },
  { label: '3일 보유, SL=-5%', hold: 3, sl: -0.05, tp: 0.05 },
  { label: '5일 보유, SL=-5%', hold: 5, sl: -0.05, tp: 0.05 },
  { label: '7일 보유, SL=-7%', hold: 7, sl: -0.07, tp: 0.07 }
];

console.log('─'.repeat(80));
for (const bs of bearStrategies) {
  if (bs.hold === 0) {
    console.log(`  ${bs.label.padEnd(28)} → 거래 0건, 손실 회피`);
    continue;
  }
  // 상승장은 7일 고정, 하락장만 변경
  const r = simulateStrategy(
    signals,
    0.5,
    7,
    bs.hold,
    -0.05,
    bs.sl,
    0.05,
    bs.tp
  );
  const bearOnly = signals.filter((s) => s.prevBreadth < 0.5);
  const bearReturns = bearOnly.map((s) => {
    // 간이 계산
    const exitIdx = Math.min(bs.hold, s.forward.length) - 1;
    return (s.forward[exitIdx]!.open - s.buyPrice) / s.buyPrice;
  });
  const bearAvg =
    bearReturns.length > 0
      ? bearReturns.reduce((s2, r2) => s2 + r2, 0) / bearReturns.length
      : 0;
  console.log(
    `  ${bs.label.padEnd(28)} → 전체 PF: ${r.profitFactor.toFixed(2)}, 하락장 수익: ${(r.bearAvgReturn * 100).toFixed(2)}%, 하락장 승률: ${(r.bearWinRate * 100).toFixed(1)}%`
  );
}

// 7단계: 최종 추천
console.log('\n=== 최종 추천 전략 ===');

// PF 상위 중 거래 수 100건 이상
const robustResults = results.filter((r) => r.totalTrades >= 100);
robustResults.sort((a, b) => b.profitFactor - a.profitFactor);

if (robustResults.length > 0) {
  const rec = robustResults[0]!;
  console.log(`\n  전략: ${rec.label}`);
  console.log(
    `  거래: ${rec.totalTrades}건 (상승 ${rec.bullTrades} / 하락 ${rec.bearTrades})`
  );
  console.log(`  평균 수익률: ${(rec.avgReturn * 100).toFixed(2)}%`);
  console.log(`  중앙값: ${(rec.medianReturn * 100).toFixed(2)}%`);
  console.log(`  승률: ${(rec.winRate * 100).toFixed(1)}%`);
  console.log(`  Profit Factor: ${rec.profitFactor.toFixed(2)}`);
  console.log(
    `  상승장 수익: ${(rec.bullAvgReturn * 100).toFixed(2)}% (승률 ${(rec.bullWinRate * 100).toFixed(1)}%)`
  );
  console.log(
    `  하락장 수익: ${(rec.bearAvgReturn * 100).toFixed(2)}% (승률 ${(rec.bearWinRate * 100).toFixed(1)}%)`
  );
}

// PF 상위 중 거래수 500건 이상 (더 보수적)
const conservResults = results.filter((r) => r.totalTrades >= 500);
conservResults.sort((a, b) => b.profitFactor - a.profitFactor);

if (conservResults.length > 0) {
  const rec2 = conservResults[0]!;
  console.log(`\n  [보수적 대안] ${rec2.label}`);
  console.log(
    `  거래: ${rec2.totalTrades}건, 수익: ${(rec2.avgReturn * 100).toFixed(2)}%, PF: ${rec2.profitFactor.toFixed(2)}`
  );
}

db.close();
