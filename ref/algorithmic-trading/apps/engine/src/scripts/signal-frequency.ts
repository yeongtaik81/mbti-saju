/**
 * 매수 신호 빈도 분석
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import Database from 'better-sqlite3';
import { sma, donchianChannel } from '../strategy/indicators.js';
import type { Candle } from '@trading/shared/types';

const DB_PATH =
  process.env['DB_PATH'] || path.resolve(__dirname, '../../data/trading.db');
const db = new Database(DB_PATH, { readonly: true });

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

console.log(`=== 매수 신호 빈도 분석 ===`);
console.log(`거래일: ${allDates.length}일\n`);

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

function countSignals(maShort: number, maLong: number, entryP: number) {
  const buyDates = new Map<
    string,
    { ma: number; turtle: number; both: number }
  >();

  for (const code of stockCodes) {
    const candles = stockCandles.get(code)!;
    if (candles.length < Math.max(maLong, entryP) + 2) continue;
    const sm = sma(candles, maShort);
    const lm = sma(candles, maLong);
    const dc = donchianChannel(candles, entryP);

    for (let i = 1; i < candles.length; i++) {
      const s = sm[i],
        l = lm[i],
        ps = sm[i - 1],
        pl = lm[i - 1];
      const prevUpper = dc.upper[i - 1];
      if (
        s == null ||
        l == null ||
        ps == null ||
        pl == null ||
        prevUpper == null
      )
        continue;

      const maGolden = ps <= pl && s > l;
      const turtleBreak = candles[i]!.high > prevUpper;
      const date = candles[i]!.date;

      if (!buyDates.has(date))
        buyDates.set(date, { ma: 0, turtle: 0, both: 0 });
      const entry = buyDates.get(date)!;
      if (maGolden) entry.ma++;
      if (turtleBreak) entry.turtle++;
      if (maGolden && turtleBreak) entry.both++;
    }
  }

  let maDays = 0,
    turtleDays = 0,
    bothDays = 0;
  let maTotal = 0,
    turtleTotal = 0,
    bothTotal = 0;
  const bothPerDay: number[] = [];

  for (const [, counts] of buyDates) {
    if (counts.ma > 0) {
      maDays++;
      maTotal += counts.ma;
    }
    if (counts.turtle > 0) {
      turtleDays++;
      turtleTotal += counts.turtle;
    }
    if (counts.both > 0) {
      bothDays++;
      bothTotal += counts.both;
      bothPerDay.push(counts.both);
    }
  }

  // 신호 없는 연속일 분석
  let maxGap = 0,
    currentGap = 0;
  const gaps: number[] = [];
  for (const date of allDates) {
    const entry = buyDates.get(date);
    if (entry && entry.both > 0) {
      if (currentGap > 0) gaps.push(currentGap);
      currentGap = 0;
    } else {
      currentGap++;
    }
  }
  if (currentGap > 0) gaps.push(currentGap);
  maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;
  const avgGap =
    gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0;

  return {
    maDays,
    turtleDays,
    bothDays,
    maTotal,
    turtleTotal,
    bothTotal,
    bothPerDay,
    maxGap,
    avgGap
  };
}

// 1순위: MA10/50 + Turtle40/20
const s1 = countSignals(10, 50, 40);
console.log(`[1순위] MA10/50 + Turtle40/20 (sl=-5%, hold=10d)`);
console.log(`  MA10/50 골든크로스:`);
console.log(
  `    발생일: ${s1.maDays}/${allDates.length}일 (매 ${(allDates.length / s1.maDays).toFixed(1)}거래일에 1번)`
);
console.log(
  `    총 종목수: ${s1.maTotal}건 (일평균 ${(s1.maTotal / s1.maDays).toFixed(1)}종목)`
);
console.log(`  Turtle 40일 돌파:`);
console.log(
  `    발생일: ${s1.turtleDays}/${allDates.length}일 (매 ${(allDates.length / s1.turtleDays).toFixed(1)}거래일에 1번)`
);
console.log(
  `    총 종목수: ${s1.turtleTotal}건 (일평균 ${(s1.turtleTotal / s1.turtleDays).toFixed(1)}종목)`
);
console.log(`  ★ 교집합 (둘 다 충족):`);
console.log(
  `    발생일: ${s1.bothDays}/${allDates.length}일 (매 ${(allDates.length / s1.bothDays).toFixed(1)}거래일에 1번)`
);
console.log(
  `    총 종목수: ${s1.bothTotal}건 (일평균 ${(s1.bothTotal / Math.max(s1.bothDays, 1)).toFixed(1)}종목)`
);
console.log(`    신호 없는 최장 연속: ${s1.maxGap}거래일`);
console.log(`    신호 없는 평균 연속: ${s1.avgGap.toFixed(1)}거래일`);

console.log();

// 2순위: MA5/20 + Turtle20/10
const s2 = countSignals(5, 20, 20);
console.log(`[2순위] MA5/20 + Turtle20/10 (sl=-5%, tp=5%, hold=10d)`);
console.log(`  MA5/20 골든크로스:`);
console.log(
  `    발생일: ${s2.maDays}/${allDates.length}일 (매 ${(allDates.length / s2.maDays).toFixed(1)}거래일에 1번)`
);
console.log(
  `    총 종목수: ${s2.maTotal}건 (일평균 ${(s2.maTotal / s2.maDays).toFixed(1)}종목)`
);
console.log(`  Turtle 20일 돌파:`);
console.log(
  `    발생일: ${s2.turtleDays}/${allDates.length}일 (매 ${(allDates.length / s2.turtleDays).toFixed(1)}거래일에 1번)`
);
console.log(
  `    총 종목수: ${s2.turtleTotal}건 (일평균 ${(s2.turtleTotal / s2.turtleDays).toFixed(1)}종목)`
);
console.log(`  ★ 교집합 (둘 다 충족):`);
console.log(
  `    발생일: ${s2.bothDays}/${allDates.length}일 (매 ${(allDates.length / s2.bothDays).toFixed(1)}거래일에 1번)`
);
console.log(
  `    총 종목수: ${s2.bothTotal}건 (일평균 ${(s2.bothTotal / Math.max(s2.bothDays, 1)).toFixed(1)}종목)`
);
console.log(`    신호 없는 최장 연속: ${s2.maxGap}거래일`);
console.log(`    신호 없는 평균 연속: ${s2.avgGap.toFixed(1)}거래일`);

db.close();
