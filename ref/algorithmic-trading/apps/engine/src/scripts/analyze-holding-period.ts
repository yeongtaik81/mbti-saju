/**
 * 매수 신호 발생 후 최적 보유 기간 분석
 *
 * 4가지 매수 조건 충족 시점부터 1~7 거래일간 수익률을 추적하여
 * 최적의 보유 기간을 찾는다.
 *
 * 사용법:
 *   pnpm --filter @trading/engine analyze:holding
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

// ── 파라미터 ──
const K = 0.5;
const SHORT_MA = 5;
const LONG_MA = 20;
const RSI_PERIOD = 14;
const RSI_LOW = 30;
const RSI_HIGH = 70;
const MAX_HOLD_DAYS = 7;
const LOOKBACK = Math.max(LONG_MA, RSI_PERIOD, 20) + 10;

// ── 데이터 로드 ──
const stockCodes = (
  db
    .prepare(
      'SELECT DISTINCT stock_code FROM daily_candles ORDER BY stock_code'
    )
    .all() as { stock_code: string }[]
).map((r) => r.stock_code);

console.log(`=== 매수 신호 후 보유 기간 분석 ===`);
console.log(`종목: ${stockCodes.length}개`);
console.log(
  `파라미터: K=${K}, MA=${SHORT_MA}/${LONG_MA}, RSI=${RSI_PERIOD}(${RSI_LOW}-${RSI_HIGH})`
);
console.log(`분석 기간: 1~${MAX_HOLD_DAYS} 거래일\n`);

interface SignalResult {
  stockCode: string;
  signalDate: string;
  buyPrice: number; // 돌파 가격 (시가 + K × 전일레인지)
  // 1~7일 후 시가, 고가, 저가, 종가
  forwardData: {
    day: number;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }[];
}

const allSignals: SignalResult[] = [];

const getDailyCandles = db.prepare<[string]>(
  `SELECT stock_code AS stockCode, date, open, high, low, close, adj_close AS adjClose, volume, amount
   FROM daily_candles WHERE stock_code = ? ORDER BY date ASC`
);

for (const stockCode of stockCodes) {
  const candles = getDailyCandles.all(stockCode) as Candle[];
  if (candles.length < LOOKBACK + MAX_HOLD_DAYS) continue;

  // 지표 계산
  const shortMaValues = sma(candles, SHORT_MA);
  const longMaValues = sma(candles, LONG_MA);
  const rsiValues = rsi(candles, RSI_PERIOD);

  for (let i = 1; i < candles.length - MAX_HOLD_DAYS; i++) {
    const prev = candles[i - 1]!;
    const today = candles[i]!;

    const prevRange = prev.high - prev.low;
    if (prevRange <= 0) continue;

    const breakoutThreshold = today.open + prevRange * K;
    const sm = shortMaValues[i];
    const lm = longMaValues[i];
    const curRsi = rsiValues[i];

    if (sm === null || sm === undefined) continue;
    if (lm === null || lm === undefined) continue;
    if (curRsi === null || curRsi === undefined) continue;

    // 4가지 매수 조건 체크
    const isBuySignal =
      today.high >= breakoutThreshold && // 1. 변동성 돌파
      sm > lm && // 2. MA 골든크로스
      curRsi >= RSI_LOW && // 3. RSI 하한
      curRsi <= RSI_HIGH; // 4. RSI 상한

    if (!isBuySignal) continue;

    // 매수가 = 돌파 가격
    const buyPrice = breakoutThreshold;

    // 향후 1~7 거래일 데이터 수집
    const forwardData: SignalResult['forwardData'] = [];
    for (let d = 1; d <= MAX_HOLD_DAYS; d++) {
      const futureIdx = i + d;
      if (futureIdx >= candles.length) break;
      const fc = candles[futureIdx]!;
      forwardData.push({
        day: d,
        date: fc.date,
        open: fc.open,
        high: fc.high,
        low: fc.low,
        close: fc.close
      });
    }

    if (forwardData.length === MAX_HOLD_DAYS) {
      allSignals.push({
        stockCode,
        signalDate: today.date,
        buyPrice,
        forwardData
      });
    }
  }
}

console.log(`총 매수 신호: ${allSignals.length}건\n`);

if (allSignals.length === 0) {
  console.log('매수 신호가 없습니다.');
  db.close();
  process.exit(0);
}

// ── 보유 기간별 분석 ──

console.log('=== 보유 기간별 수익률 분석 (매도: 해당일 시가) ===');
console.log('─'.repeat(90));
console.log(
  'Day'.padStart(4),
  '| 평균수익률'.padEnd(12),
  '| 중앙값'.padEnd(10),
  '| 승률'.padEnd(8),
  '| 최대이익'.padEnd(10),
  '| 최대손실'.padEnd(10),
  '| 수익건'.padEnd(8),
  '| 손실건'.padEnd(8),
  '| PF'
);
console.log('─'.repeat(90));

interface DayStats {
  day: number;
  avgReturn: number;
  medianReturn: number;
  winRate: number;
  maxWin: number;
  maxLoss: number;
  wins: number;
  losses: number;
  profitFactor: number;
}

const dayStats: DayStats[] = [];

for (let d = 1; d <= MAX_HOLD_DAYS; d++) {
  // 시가 매도 수익률
  const returns = allSignals.map((s) => {
    const fd = s.forwardData.find((f) => f.day === d)!;
    return (fd.open - s.buyPrice) / s.buyPrice;
  });

  returns.sort((a, b) => a - b);

  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const median = returns[Math.floor(returns.length / 2)]!;
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  const winRate = wins.length / returns.length;
  const maxWin = returns[returns.length - 1]!;
  const maxLoss = returns[0]!;

  const totalProfit = wins.reduce((s, r) => s + r, 0);
  const totalLoss = Math.abs(losses.reduce((s, r) => s + r, 0));
  const pf =
    totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  dayStats.push({
    day: d,
    avgReturn: avg,
    medianReturn: median,
    winRate,
    maxWin,
    maxLoss,
    wins: wins.length,
    losses: losses.length,
    profitFactor: pf
  });

  console.log(
    `${d}일`.padStart(4),
    `| ${(avg * 100).toFixed(2)}%`.padEnd(12),
    `| ${(median * 100).toFixed(2)}%`.padEnd(10),
    `| ${(winRate * 100).toFixed(1)}%`.padEnd(8),
    `| +${(maxWin * 100).toFixed(1)}%`.padEnd(10),
    `| ${(maxLoss * 100).toFixed(1)}%`.padEnd(10),
    `| ${wins.length}건`.padEnd(8),
    `| ${losses.length}건`.padEnd(8),
    `| ${pf.toFixed(2)}`
  );
}

// ── 보유 기간별 분석 (종가 매도) ──
console.log('\n=== 보유 기간별 수익률 분석 (매도: 해당일 종가) ===');
console.log('─'.repeat(90));
console.log(
  'Day'.padStart(4),
  '| 평균수익률'.padEnd(12),
  '| 중앙값'.padEnd(10),
  '| 승률'.padEnd(8),
  '| 최대이익'.padEnd(10),
  '| 최대손실'.padEnd(10),
  '| 수익건'.padEnd(8),
  '| 손실건'.padEnd(8),
  '| PF'
);
console.log('─'.repeat(90));

for (let d = 1; d <= MAX_HOLD_DAYS; d++) {
  const returns = allSignals.map((s) => {
    const fd = s.forwardData.find((f) => f.day === d)!;
    return (fd.close - s.buyPrice) / s.buyPrice;
  });

  returns.sort((a, b) => a - b);
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const median = returns[Math.floor(returns.length / 2)]!;
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  const winRate = wins.length / returns.length;
  const maxWin = returns[returns.length - 1]!;
  const maxLoss = returns[0]!;
  const totalProfit = wins.reduce((s, r) => s + r, 0);
  const totalLoss = Math.abs(losses.reduce((s, r) => s + r, 0));
  const pf =
    totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  console.log(
    `${d}일`.padStart(4),
    `| ${(avg * 100).toFixed(2)}%`.padEnd(12),
    `| ${(median * 100).toFixed(2)}%`.padEnd(10),
    `| ${(winRate * 100).toFixed(1)}%`.padEnd(8),
    `| +${(maxWin * 100).toFixed(1)}%`.padEnd(10),
    `| ${(maxLoss * 100).toFixed(1)}%`.padEnd(10),
    `| ${wins.length}건`.padEnd(8),
    `| ${losses.length}건`.padEnd(8),
    `| ${pf.toFixed(2)}`
  );
}

// ── 기간 중 최고가 분석 ──
console.log('\n=== 보유 기간 중 도달 최고가 분석 ===');
console.log('─'.repeat(70));
console.log(
  'Day'.padStart(4),
  '| 평균 최고수익'.padEnd(14),
  '| 중앙값'.padEnd(10),
  '| 5%이상 도달률'.padEnd(14),
  '| 3%이상 도달률'.padEnd(14)
);
console.log('─'.repeat(70));

for (let d = 1; d <= MAX_HOLD_DAYS; d++) {
  // d일까지의 최고가 대비 수익률
  const maxReturns = allSignals.map((s) => {
    let maxHigh = 0;
    for (let dd = 1; dd <= d; dd++) {
      const fd = s.forwardData.find((f) => f.day === dd)!;
      if (fd.high > maxHigh) maxHigh = fd.high;
    }
    return (maxHigh - s.buyPrice) / s.buyPrice;
  });

  maxReturns.sort((a, b) => a - b);
  const avg = maxReturns.reduce((s, r) => s + r, 0) / maxReturns.length;
  const median = maxReturns[Math.floor(maxReturns.length / 2)]!;
  const above5 = maxReturns.filter((r) => r >= 0.05).length / maxReturns.length;
  const above3 = maxReturns.filter((r) => r >= 0.03).length / maxReturns.length;

  console.log(
    `${d}일`.padStart(4),
    `| ${(avg * 100).toFixed(2)}%`.padEnd(14),
    `| ${(median * 100).toFixed(2)}%`.padEnd(10),
    `| ${(above5 * 100).toFixed(1)}%`.padEnd(14),
    `| ${(above3 * 100).toFixed(1)}%`.padEnd(14)
  );
}

// ── 종목별 신호 빈도 ──
console.log('\n=== 종목별 매수 신호 빈도 (상위 15) ===');
const stockSignalCount = new Map<string, number>();
for (const s of allSignals) {
  stockSignalCount.set(
    s.stockCode,
    (stockSignalCount.get(s.stockCode) || 0) + 1
  );
}
const sortedStocks = Array.from(stockSignalCount.entries()).sort(
  (a, b) => b[1] - a[1]
);
for (const [code, count] of sortedStocks.slice(0, 15)) {
  // 해당 종목 1일 시가매도 평균 수익률
  const stockReturns = allSignals
    .filter((s) => s.stockCode === code)
    .map((s) => (s.forwardData[0]!.open - s.buyPrice) / s.buyPrice);
  const avg = stockReturns.reduce((s, r) => s + r, 0) / stockReturns.length;
  console.log(
    `  ${code}: ${count}건 (1일 시가매도 평균: ${(avg * 100).toFixed(2)}%)`
  );
}

// ── 최적 보유 기간 결론 ──
console.log('\n=== 결론 ===');
const bestByAvg = dayStats.reduce(
  (best, cur) => (cur.avgReturn > best.avgReturn ? cur : best),
  dayStats[0]!
);
const bestByWinRate = dayStats.reduce(
  (best, cur) => (cur.winRate > best.winRate ? cur : best),
  dayStats[0]!
);
const bestByPF = dayStats.reduce(
  (best, cur) => (cur.profitFactor > best.profitFactor ? cur : best),
  dayStats[0]!
);

console.log(
  `  평균수익률 최고: ${bestByAvg.day}일 (${(bestByAvg.avgReturn * 100).toFixed(2)}%)`
);
console.log(
  `  승률 최고:       ${bestByWinRate.day}일 (${(bestByWinRate.winRate * 100).toFixed(1)}%)`
);
console.log(
  `  PF 최고:         ${bestByPF.day}일 (${bestByPF.profitFactor.toFixed(2)})`
);

db.close();
