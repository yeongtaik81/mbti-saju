/**
 * 후보 다수 발생일: 거래량 급등 상위 vs 하위 수익률 비교
 *
 * 가설: 스크리닝 후보가 많은 날, 거래량 급등(todayVol/avgVol20) 상위 종목을
 *       우선 매수하면 수익률이 더 좋은가?
 *
 * 방법:
 *   1) 매일 전 종목에 대해 MA 골든크로스 + Donchian 상단 돌파 → 후보 선정
 *   2) 후보 10개 이상인 날만 필터
 *   3) 거래량 비율(todayVolume / avgVolume20) 기준 상위 50% vs 하위 50% 분리
 *   4) 다음날 시가 매수 → HOLD_DAYS일 보유 (SL 적용) → 수익률 비교
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

// ── 전략 파라미터 ──
const CONFIGS = [
  {
    label: 'A 공격형 (MA10/50, DC40, hold10)',
    shortMa: 10,
    longMa: 50,
    dcPeriod: 40,
    holdDays: 10,
    sl: -0.05
  },
  {
    label: 'B 안정형 (MA5/20, DC20, hold7)',
    shortMa: 5,
    longMa: 20,
    dcPeriod: 20,
    holdDays: 7,
    sl: -0.05
  }
];
const MIN_CANDIDATES = 1;
const VOL_AVG_PERIOD = 20;

// ── 데이터 로드 ──
console.log('데이터 로드 중...');
const stockCodes = (
  db
    .prepare(
      'SELECT DISTINCT stock_code FROM daily_candles ORDER BY stock_code'
    )
    .all() as { stock_code: string }[]
).map((r) => r.stock_code);

const getDailyCandles = db.prepare<[string]>(
  `SELECT stock_code AS stockCode, date, open, high, low, close,
          adj_close AS adjClose, volume, amount
   FROM daily_candles WHERE stock_code = ? ORDER BY date ASC`
);

const allCandles = new Map<string, Candle[]>();
for (const code of stockCodes) {
  const candles = getDailyCandles.all(code) as Candle[];
  if (candles.length > 60) allCandles.set(code, candles);
}
console.log(`종목 수: ${allCandles.size}개\n`);

// ── 종목별 지표 사전 계산 ──
interface PrecomputedIndicators {
  shortMaArr: (number | null)[];
  longMaArr: (number | null)[];
  dcUpper: (number | null)[];
  candles: Candle[];
}

function precompute(
  shortMa: number,
  longMa: number,
  dcPeriod: number
): Map<string, PrecomputedIndicators> {
  const result = new Map<string, PrecomputedIndicators>();
  for (const [code, candles] of allCandles) {
    result.set(code, {
      shortMaArr: sma(candles, shortMa),
      longMaArr: sma(candles, longMa),
      dcUpper: donchianChannel(candles, dcPeriod).upper,
      candles
    });
  }
  return result;
}

// ── 거래량 비율 계산 ──
function getVolumeRatio(candles: Candle[], idx: number): number {
  if (idx < VOL_AVG_PERIOD) return 0;
  let sum = 0;
  for (let j = idx - VOL_AVG_PERIOD; j < idx; j++) {
    sum += candles[j]!.volume;
  }
  const avg = sum / VOL_AVG_PERIOD;
  if (avg <= 0) return 0;
  return candles[idx]!.volume / avg;
}

// ── 날짜 인덱스 맵 ──
function buildDateIndex(candles: Candle[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < candles.length; i++) {
    map.set(candles[i]!.date, i);
  }
  return map;
}

// ── 거래 결과 ──
interface Trade {
  stockCode: string;
  date: string;
  volumeRatio: number;
  returnPct: number;
  slTriggered: boolean;
}

// ── 통계 계산 ──
function calcStats(trades: Trade[]) {
  if (trades.length === 0) return null;
  const returns = trades.map((t) => t.returnPct).sort((a, b) => a - b);
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const median = returns[Math.floor(returns.length / 2)]!;
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  const winRate = wins.length / returns.length;
  const totalProfit = wins.reduce((s, r) => s + r, 0);
  const totalLoss = Math.abs(losses.reduce((s, r) => s + r, 0));
  const pf = totalLoss > 0 ? totalProfit / totalLoss : Infinity;
  const slCount = trades.filter((t) => t.slTriggered).length;

  // 평균 거래량 비율
  const avgVR = trades.reduce((s, t) => s + t.volumeRatio, 0) / trades.length;

  // MDD
  let cum = 1,
    maxCum = 1,
    maxDD = 0;
  for (const t of trades) {
    cum *= 1 + t.returnPct;
    if (cum > maxCum) maxCum = cum;
    const dd = (cum - maxCum) / maxCum;
    if (dd < maxDD) maxDD = dd;
  }

  return {
    count: trades.length,
    avg: (avg * 100).toFixed(2),
    median: (median * 100).toFixed(2),
    winRate: (winRate * 100).toFixed(1),
    pf: pf === Infinity ? '∞' : pf.toFixed(2),
    maxLoss: (returns[0]! * 100).toFixed(1),
    maxWin: (returns[returns.length - 1]! * 100).toFixed(1),
    slRate: ((slCount / trades.length) * 100).toFixed(1),
    mdd: (maxDD * 100).toFixed(1),
    avgVR: avgVR.toFixed(1)
  };
}

function printStats(label: string, s: ReturnType<typeof calcStats>) {
  if (!s) {
    console.log(`  ${label}: 거래 없음`);
    return;
  }
  console.log(
    `  ${label.padEnd(14)} | ` +
      `거래 ${String(s.count).padStart(5)} | ` +
      `평균 ${s.avg.padStart(6)}% | ` +
      `중앙 ${s.median.padStart(6)}% | ` +
      `승률 ${s.winRate.padStart(5)}% | ` +
      `PF ${s.pf.padStart(5)} | ` +
      `최대손 ${s.maxLoss.padStart(6)}% | ` +
      `SL ${s.slRate.padStart(5)}% | ` +
      `MDD ${s.mdd.padStart(6)}% | ` +
      `평균VR ${s.avgVR.padStart(4)}x`
  );
}

// ── 메인 분석 ──
for (const config of CONFIGS) {
  console.log(`\n${'━'.repeat(120)}`);
  console.log(`전략: ${config.label}`);
  console.log(
    `후보 최소: ${MIN_CANDIDATES}개, 손절: ${(config.sl * 100).toFixed(0)}%`
  );
  console.log(`${'━'.repeat(120)}`);

  const indicators = precompute(config.shortMa, config.longMa, config.dcPeriod);
  const lookback = Math.max(config.longMa, config.dcPeriod, VOL_AVG_PERIOD);

  // 날짜별 인덱스 맵 구축
  const dateIndices = new Map<string, Map<string, number>>();
  for (const [code, ind] of indicators) {
    dateIndices.set(code, buildDateIndex(ind.candles));
  }

  // 모든 날짜 수집
  const allDatesSet = new Set<string>();
  for (const [, ind] of indicators) {
    for (const c of ind.candles) allDatesSet.add(c.date);
  }
  const allDates = Array.from(allDatesSet).sort();

  // 날짜별 후보 수집
  interface Candidate {
    stockCode: string;
    idx: number;
    volumeRatio: number;
    candles: Candle[];
  }

  let totalDays = 0;
  let candidateDays = 0;
  const highVRTrades: Trade[] = [];
  const lowVRTrades: Trade[] = [];
  const allTrades: Trade[] = [];

  for (const date of allDates) {
    const candidates: Candidate[] = [];

    for (const [code, ind] of indicators) {
      const idxMap = dateIndices.get(code)!;
      const idx = idxMap.get(date);
      if (idx === undefined || idx < lookback) continue;

      const c = ind.candles[idx]!;
      const sm = ind.shortMaArr[idx];
      const lm = ind.longMaArr[idx];
      const dcUp = ind.dcUpper[idx - 1]; // 전일 Donchian 상단

      if (sm === null || sm === undefined) continue;
      if (lm === null || lm === undefined) continue;
      if (dcUp === null || dcUp === undefined) continue;

      // 매수 조건: MA 골든크로스 + Donchian 상단 돌파
      if (sm <= lm) continue;
      if (c.close <= dcUp) continue;

      const vr = getVolumeRatio(ind.candles, idx);
      if (vr <= 0) continue;

      candidates.push({
        stockCode: code,
        idx,
        volumeRatio: vr,
        candles: ind.candles
      });
    }

    totalDays++;
    if (candidates.length < MIN_CANDIDATES) continue;
    candidateDays++;

    // 거래량 비율 기준 정렬 (내림차순)
    candidates.sort((a, b) => b.volumeRatio - a.volumeRatio);
    const mid = Math.ceil(candidates.length / 2);
    const highGroup = candidates.slice(0, mid);
    const lowGroup = candidates.slice(mid);

    // 거래 시뮬레이션
    function simulateTrade(cand: Candidate): Trade | null {
      const buyIdx = cand.idx + 1; // 다음날 시가 매수
      if (buyIdx >= cand.candles.length) return null;
      const buyPrice = cand.candles[buyIdx]!.open;
      if (buyPrice <= 0) return null;

      let sellDay = config.holdDays;
      let slTriggered = false;

      // 손절 체크
      for (let d = 0; d <= config.holdDays; d++) {
        const fi = buyIdx + d;
        if (fi >= cand.candles.length) break;
        if ((cand.candles[fi]!.low - buyPrice) / buyPrice <= config.sl) {
          sellDay = d;
          slTriggered = true;
          break;
        }
      }

      let sellPrice: number;
      if (slTriggered) {
        sellPrice = buyPrice * (1 + config.sl);
      } else {
        const sellIdx = buyIdx + config.holdDays;
        if (sellIdx >= cand.candles.length) return null;
        sellPrice = cand.candles[sellIdx]!.open;
      }

      return {
        stockCode: cand.stockCode,
        date,
        volumeRatio: cand.volumeRatio,
        returnPct: (sellPrice - buyPrice) / buyPrice,
        slTriggered
      };
    }

    for (const cand of highGroup) {
      const trade = simulateTrade(cand);
      if (trade) {
        highVRTrades.push(trade);
        allTrades.push(trade);
      }
    }
    for (const cand of lowGroup) {
      const trade = simulateTrade(cand);
      if (trade) {
        lowVRTrades.push(trade);
        allTrades.push(trade);
      }
    }
  }

  console.log(
    `\n총 거래일: ${totalDays}일, 후보 ${MIN_CANDIDATES}개+ 발생일: ${candidateDays}일`
  );
  console.log(`${'─'.repeat(120)}`);
  console.log(
    `  ${'그룹'.padEnd(14)} | ` +
      `${'거래수'.padStart(7)} | ` +
      `${'평균수익'.padStart(8)} | ` +
      `${'중앙값'.padStart(8)} | ` +
      `${'승률'.padStart(7)} | ` +
      `${'PF'.padStart(6)} | ` +
      `${'최대손실'.padStart(9)} | ` +
      `${'SL발동'.padStart(7)} | ` +
      `${'MDD'.padStart(8)} | ` +
      `${'평균VR'.padStart(7)}`
  );
  console.log(`${'─'.repeat(120)}`);

  printStats('거래량 상위 50%', calcStats(highVRTrades));
  printStats('거래량 하위 50%', calcStats(lowVRTrades));
  printStats('전체 (참고)', calcStats(allTrades));

  // 분위별 상세 분석
  if (allTrades.length > 0) {
    console.log(`\n  ── 거래량 비율 분위별 상세 ──`);
    const sorted = [...allTrades].sort((a, b) => a.volumeRatio - b.volumeRatio);
    const q = Math.ceil(sorted.length / 4);
    const quartiles = [
      { label: 'Q1 (VR 최하위)', trades: sorted.slice(0, q) },
      { label: 'Q2', trades: sorted.slice(q, q * 2) },
      { label: 'Q3', trades: sorted.slice(q * 2, q * 3) },
      { label: 'Q4 (VR 최상위)', trades: sorted.slice(q * 3) }
    ];

    console.log(`${'─'.repeat(120)}`);
    for (const { label, trades } of quartiles) {
      printStats(label, calcStats(trades));
    }
  }
}

// ── VR 상한 필터 적용 시 후보 감소율 + 성과 비교 ──
console.log(`\n\n${'━'.repeat(120)}`);
console.log('VR 상한 필터 적용 시 후보 감소율 및 성과 (전략 A/B)');
console.log(`${'━'.repeat(120)}`);

const vrCaps = [Infinity, 10, 7, 5, 3, 2, 1.5];

for (const config of CONFIGS) {
  const indicators2 = precompute(
    config.shortMa,
    config.longMa,
    config.dcPeriod
  );
  const lookback2 = Math.max(config.longMa, config.dcPeriod, VOL_AVG_PERIOD);
  const dateIndices2 = new Map<string, Map<string, number>>();
  for (const [code, ind] of indicators2) {
    dateIndices2.set(code, buildDateIndex(ind.candles));
  }
  const allDatesSet2 = new Set<string>();
  for (const [, ind] of indicators2) {
    for (const c of ind.candles) allDatesSet2.add(c.date);
  }
  const allDates2 = Array.from(allDatesSet2).sort();

  // 전체 후보 수집 (VR 필터 없이)
  interface CandWithTrade {
    volumeRatio: number;
    returnPct: number;
    slTriggered: boolean;
  }
  const allCandTrades: CandWithTrade[] = [];

  for (const date of allDates2) {
    for (const [code, ind] of indicators2) {
      const idxMap = dateIndices2.get(code)!;
      const idx = idxMap.get(date);
      if (idx === undefined || idx < lookback2) continue;

      const c = ind.candles[idx]!;
      const sm = ind.shortMaArr[idx];
      const lm = ind.longMaArr[idx];
      const dcUp = ind.dcUpper[idx - 1];
      if (sm === null || sm === undefined) continue;
      if (lm === null || lm === undefined) continue;
      if (dcUp === null || dcUp === undefined) continue;
      if (sm <= lm || c.close <= dcUp) continue;

      const vr = getVolumeRatio(ind.candles, idx);
      if (vr <= 0) continue;

      const buyIdx = idx + 1;
      if (buyIdx >= ind.candles.length) continue;
      const buyPrice = ind.candles[buyIdx]!.open;
      if (buyPrice <= 0) continue;

      let sellDay = config.holdDays;
      let slTriggered = false;
      for (let d = 0; d <= config.holdDays; d++) {
        const fi = buyIdx + d;
        if (fi >= ind.candles.length) break;
        if ((ind.candles[fi]!.low - buyPrice) / buyPrice <= config.sl) {
          sellDay = d;
          slTriggered = true;
          break;
        }
      }
      let sellPrice: number;
      if (slTriggered) {
        sellPrice = buyPrice * (1 + config.sl);
      } else {
        const si = buyIdx + config.holdDays;
        if (si >= ind.candles.length) continue;
        sellPrice = ind.candles[si]!.open;
      }
      allCandTrades.push({
        volumeRatio: vr,
        returnPct: (sellPrice - buyPrice) / buyPrice,
        slTriggered
      });
    }
  }

  const totalCount = allCandTrades.length;
  console.log(`\n전략: ${config.label}  (전체 후보: ${totalCount}건)`);
  console.log(`${'─'.repeat(130)}`);
  console.log(
    `  ${'VR 상한'.padEnd(10)} | ` +
      `${'후보수'.padStart(7)} | ` +
      `${'감소율'.padStart(6)} | ` +
      `${'평균수익'.padStart(8)} | ` +
      `${'중앙값'.padStart(8)} | ` +
      `${'승률'.padStart(7)} | ` +
      `${'PF'.padStart(6)} | ` +
      `${'SL발동'.padStart(7)} | ` +
      `${'MDD'.padStart(8)}`
  );
  console.log(`${'─'.repeat(130)}`);

  for (const cap of vrCaps) {
    const filtered = allCandTrades.filter((t) => t.volumeRatio <= cap);
    const count = filtered.length;
    const pct = ((1 - count / totalCount) * 100).toFixed(1);
    const returns = filtered.map((t) => t.returnPct).sort((a, b) => a - b);
    if (returns.length === 0) {
      console.log(
        `  ${cap === Infinity ? '없음(전체)' : `≤ ${cap}x`}`.padEnd(12) +
          ` |       0 | ${pct.padStart(5)}% | 거래 없음`
      );
      continue;
    }
    const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
    const median = returns[Math.floor(returns.length / 2)]!;
    const wins = returns.filter((r) => r > 0);
    const losses = returns.filter((r) => r <= 0);
    const winRate = wins.length / returns.length;
    const totalProfit = wins.reduce((s, r) => s + r, 0);
    const totalLoss = Math.abs(losses.reduce((s, r) => s + r, 0));
    const pf = totalLoss > 0 ? totalProfit / totalLoss : Infinity;
    const slCount = filtered.filter((t) => t.slTriggered).length;
    let cum = 1,
      maxCum = 1,
      maxDD = 0;
    for (const t of filtered) {
      cum *= 1 + t.returnPct;
      if (cum > maxCum) maxCum = cum;
      const dd = (cum - maxCum) / maxCum;
      if (dd < maxDD) maxDD = dd;
    }

    const capLabel = cap === Infinity ? '없음(전체)' : `≤ ${cap}x`;
    console.log(
      `  ${capLabel.padEnd(10)} | ` +
        `${String(count).padStart(6)} | ` +
        `${pct.padStart(5)}% | ` +
        `${(avg * 100).toFixed(2).padStart(7)}% | ` +
        `${(median * 100).toFixed(2).padStart(7)}% | ` +
        `${(winRate * 100).toFixed(1).padStart(6)}% | ` +
        `${(pf === Infinity ? '∞' : pf.toFixed(2)).padStart(5)} | ` +
        `${((slCount / count) * 100).toFixed(1).padStart(6)}% | ` +
        `${(maxDD * 100).toFixed(1).padStart(7)}%`
    );
  }
}

db.close();
console.log('\n분석 완료.');
