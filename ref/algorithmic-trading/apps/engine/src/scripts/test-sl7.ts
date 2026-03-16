/**
 * 최적 전략에 SL=-7% 적용 시 성과 비교
 *
 * 상승장: MA지지 (10/60, ≤2%, breadth≥50%, 7일 보유)
 * 하락장: 변동성돌파 (K=0.4, MA=10/60, RSI14(20-80), breadth<40%, 7일 보유)
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

const HOLD_DAYS = 7;
const SL = -0.07; // -7%

// ── 데이터 로드 ──
const stockCodes = (
  db
    .prepare(
      'SELECT DISTINCT stock_code FROM daily_candles ORDER BY stock_code'
    )
    .all() as { stock_code: string }[]
).map((r) => r.stock_code);

const getDailyCandles = db.prepare<[string]>(
  `SELECT stock_code AS stockCode, date, open, high, low, close, adj_close AS adjClose, volume, amount
   FROM daily_candles WHERE stock_code = ? ORDER BY date ASC`
);

// 모든 종목 캔들 로드
const allCandles = new Map<string, Candle[]>();
for (const code of stockCodes) {
  const candles = getDailyCandles.all(code) as Candle[];
  if (candles.length > 60) allCandles.set(code, candles);
}

// ── breadth 계산 (전일 기준) ──
function computeDailyBreadth(): Map<string, number> {
  // 날짜별 breadth = % of stocks with close > 20MA
  const dateMap = new Map<string, { above: number; total: number }>();

  for (const [, candles] of allCandles) {
    const ma20 = sma(candles, 20);
    for (let i = 0; i < candles.length; i++) {
      const date = candles[i]!.date;
      if (ma20[i] === null || ma20[i] === undefined) continue;
      if (!dateMap.has(date)) dateMap.set(date, { above: 0, total: 0 });
      const entry = dateMap.get(date)!;
      entry.total++;
      if (candles[i]!.close > ma20[i]!) entry.above++;
    }
  }

  const breadth = new Map<string, number>();
  for (const [date, { above, total }] of dateMap) {
    breadth.set(date, total > 0 ? above / total : 0);
  }
  return breadth;
}

const breadth = computeDailyBreadth();

// 날짜 정렬
const allDates = Array.from(breadth.keys()).sort();
const prevBreadth = new Map<string, number>();
for (let i = 1; i < allDates.length; i++) {
  prevBreadth.set(allDates[i]!, breadth.get(allDates[i - 1]!) ?? 0);
}

interface Trade {
  stockCode: string;
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  holdDays: number;
  returnPct: number;
  slTriggered: boolean;
}

// ── 상승장 전략: MA 지지 ──
function runMaSupport(useSL: boolean): Trade[] {
  const trades: Trade[] = [];

  for (const [code, candles] of allCandles) {
    const shortMa = sma(candles, 10);
    const longMa = sma(candles, 60);

    for (let i = 60; i < candles.length - HOLD_DAYS - 1; i++) {
      const today = candles[i]!;
      const pb = prevBreadth.get(today.date);
      if (pb === undefined || pb < 0.5) continue; // 상승장만

      const sm = shortMa[i];
      const lm = longMa[i];
      if (sm === null || sm === undefined) continue;
      if (lm === null || lm === undefined) continue;
      if (sm <= lm) continue; // 상승 추세 확인

      // 종가가 60일 MA의 2% 이내
      const proximity = today.close / lm;
      if (proximity > 1.02 || proximity < 0.98) continue;

      // 다음날 시가에 매수
      const buyCandle = candles[i + 1]!;
      const buyPrice = buyCandle.open;

      // 보유 기간 중 SL 체크
      let sellDay = HOLD_DAYS;
      let slTriggered = false;

      if (useSL) {
        for (let d = 1; d <= HOLD_DAYS; d++) {
          const fc = candles[i + 1 + d];
          if (!fc) break;
          const dayReturn = (fc.low - buyPrice) / buyPrice;
          if (dayReturn <= SL) {
            sellDay = d;
            slTriggered = true;
            break;
          }
        }
      }

      // 매도
      const sellIdx = i + 1 + sellDay;
      if (sellIdx >= candles.length) continue;

      let sellPrice: number;
      if (slTriggered) {
        // SL 가격에 매도
        sellPrice = buyPrice * (1 + SL);
      } else {
        // 보유 기간 후 다음날 시가
        const sellCandle = candles[sellIdx]!;
        sellPrice = sellCandle.open;
      }

      const returnPct = (sellPrice - buyPrice) / buyPrice;
      trades.push({
        stockCode: code,
        buyDate: buyCandle.date,
        buyPrice,
        sellDate: candles[sellIdx]!.date,
        sellPrice,
        holdDays: sellDay,
        returnPct,
        slTriggered
      });
    }
  }

  return trades;
}

// ── 하락장 전략: 변동성 돌파 ──
function runBreakout(useSL: boolean): Trade[] {
  const trades: Trade[] = [];
  const K = 0.4;

  for (const [code, candles] of allCandles) {
    const shortMa = sma(candles, 10);
    const longMa = sma(candles, 60);
    const rsiValues = rsi(candles, 14);

    for (let i = 60; i < candles.length - HOLD_DAYS - 1; i++) {
      const prev = candles[i - 1]!;
      const today = candles[i]!;
      const pb = prevBreadth.get(today.date);
      if (pb === undefined || pb >= 0.4) continue; // 하락장만

      const prevRange = prev.high - prev.low;
      if (prevRange <= 0) continue;

      const breakoutThreshold = today.open + prevRange * K;
      if (today.high < breakoutThreshold) continue;

      const sm = shortMa[i];
      const lm = longMa[i];
      const curRsi = rsiValues[i];
      if (sm === null || sm === undefined) continue;
      if (lm === null || lm === undefined) continue;
      if (curRsi === null || curRsi === undefined) continue;
      if (sm <= lm) continue;
      if (curRsi < 20 || curRsi > 80) continue;

      const buyPrice = breakoutThreshold;

      let sellDay = HOLD_DAYS;
      let slTriggered = false;

      if (useSL) {
        for (let d = 0; d <= HOLD_DAYS; d++) {
          const fc = candles[i + d];
          if (!fc) break;
          if (d === 0) {
            // 매수 당일: low 체크
            const dayReturn = (fc.low - buyPrice) / buyPrice;
            if (dayReturn <= SL) {
              sellDay = d;
              slTriggered = true;
              break;
            }
          } else {
            const dayReturn = (fc.low - buyPrice) / buyPrice;
            if (dayReturn <= SL) {
              sellDay = d;
              slTriggered = true;
              break;
            }
          }
        }
      }

      const sellIdx = i + (slTriggered ? sellDay : HOLD_DAYS);
      if (sellIdx >= candles.length) continue;

      let sellPrice: number;
      if (slTriggered) {
        sellPrice = buyPrice * (1 + SL);
      } else {
        const nextIdx = i + HOLD_DAYS + 1;
        if (nextIdx >= candles.length) continue;
        sellPrice = candles[nextIdx]!.open;
      }

      const returnPct = (sellPrice - buyPrice) / buyPrice;
      trades.push({
        stockCode: code,
        buyDate: today.date,
        buyPrice,
        sellDate: candles[sellIdx]!.date,
        sellPrice,
        holdDays: slTriggered ? sellDay : HOLD_DAYS,
        returnPct,
        slTriggered
      });
    }
  }

  return trades;
}

// ── 통계 계산 ──
function printStats(label: string, trades: Trade[]) {
  if (trades.length === 0) {
    console.log(`\n${label}: 거래 없음`);
    return;
  }

  const returns = trades.map((t) => t.returnPct).sort((a, b) => a - b);
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const median = returns[Math.floor(returns.length / 2)]!;
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  const winRate = wins.length / returns.length;
  const totalProfit = wins.reduce((s, r) => s + r, 0);
  const totalLoss = Math.abs(losses.reduce((s, r) => s + r, 0));
  const pf = totalLoss > 0 ? totalProfit / totalLoss : Infinity;
  const maxWin = returns[returns.length - 1]!;
  const maxLoss = returns[0]!;

  // SL 발동 통계
  const slCount = trades.filter((t) => t.slTriggered).length;
  const slRate = slCount / trades.length;

  // 평균 보유일
  const avgHold = trades.reduce((s, t) => s + t.holdDays, 0) / trades.length;

  // 최대 연속 손실
  let maxConsecLoss = 0;
  let curConsec = 0;
  for (const t of trades) {
    if (t.returnPct <= 0) {
      curConsec++;
      maxConsecLoss = Math.max(maxConsecLoss, curConsec);
    } else curConsec = 0;
  }

  // 누적 수익률
  let cumReturn = 1;
  let maxCum = 1;
  let maxDrawdown = 0;
  for (const t of trades) {
    cumReturn *= 1 + t.returnPct;
    if (cumReturn > maxCum) maxCum = cumReturn;
    const dd = (cumReturn - maxCum) / maxCum;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  console.log(`\n${label}`);
  console.log('─'.repeat(60));
  console.log(`  거래 수:       ${trades.length}건`);
  console.log(`  평균 수익률:   ${(avg * 100).toFixed(2)}%`);
  console.log(`  중앙값:        ${(median * 100).toFixed(2)}%`);
  console.log(
    `  승률:          ${(winRate * 100).toFixed(1)}% (${wins.length}승 / ${losses.length}패)`
  );
  console.log(`  PF:            ${pf.toFixed(2)}`);
  console.log(`  최대 이익:     +${(maxWin * 100).toFixed(1)}%`);
  console.log(`  최대 손실:     ${(maxLoss * 100).toFixed(1)}%`);
  console.log(`  SL 발동:       ${slCount}건 (${(slRate * 100).toFixed(1)}%)`);
  console.log(`  평균 보유일:   ${avgHold.toFixed(1)}일`);
  console.log(`  최대 연속 손실: ${maxConsecLoss}건`);
  console.log(`  누적 수익률:   ${((cumReturn - 1) * 100).toFixed(1)}%`);
  console.log(`  최대 낙폭:     ${(maxDrawdown * 100).toFixed(1)}%`);
}

// ── 실행 ──
console.log('=== SL=-7% 적용 전후 비교 ===');
console.log(`종목: ${allCandles.size}개, 기간: 1년\n`);

console.log('━━━ 상승장: MA 지지 전략 (MA=10/60, ≤2%, breadth≥50%) ━━━');

const bullNoSL = runMaSupport(false);
printStats('[상승장] SL 없음 (기존)', bullNoSL);

const bullWithSL = runMaSupport(true);
printStats('[상승장] SL = -7%', bullWithSL);

console.log(
  '\n\n━━━ 하락장: 변동성 돌파 전략 (K=0.4, MA=10/60, RSI=14(20-80), breadth<40%) ━━━'
);

const bearNoSL = runBreakout(false);
printStats('[하락장] SL 없음 (기존)', bearNoSL);

const bearWithSL = runBreakout(true);
printStats('[하락장] SL = -7%', bearWithSL);

// ── 복합 전략 비교 ──
console.log('\n\n━━━ 복합 전략 (상승장+하락장) 비교 ━━━');

function combinedStats(label: string, bull: Trade[], bear: Trade[]) {
  const all = [...bull, ...bear].sort((a, b) =>
    a.buyDate.localeCompare(b.buyDate)
  );
  printStats(label, all);
}

combinedStats('[복합] SL 없음', bullNoSL, bearNoSL);
combinedStats('[복합] SL = -7%', bullWithSL, bearWithSL);

// ── 손실 분포 비교 ──
console.log('\n\n━━━ 손실 분포 비교 ━━━');

function lossDist(label: string, trades: Trade[]) {
  const returns = trades.map((t) => t.returnPct);
  const below3 = returns.filter((r) => r <= -0.03).length;
  const below5 = returns.filter((r) => r <= -0.05).length;
  const below7 = returns.filter((r) => r <= -0.07).length;
  const below10 = returns.filter((r) => r <= -0.1).length;
  const below15 = returns.filter((r) => r <= -0.15).length;

  console.log(`  ${label}:`);
  console.log(
    `    -3% 이하: ${below3}건 (${((below3 / trades.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `    -5% 이하: ${below5}건 (${((below5 / trades.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `    -7% 이하: ${below7}건 (${((below7 / trades.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `    -10% 이하: ${below10}건 (${((below10 / trades.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `    -15% 이하: ${below15}건 (${((below15 / trades.length) * 100).toFixed(1)}%)`
  );
}

console.log('\n[상승장 MA지지]');
lossDist('SL 없음', bullNoSL);
lossDist('SL -7%', bullWithSL);

console.log('\n[하락장 변동성돌파]');
lossDist('SL 없음', bearNoSL);
lossDist('SL -7%', bearWithSL);

db.close();
