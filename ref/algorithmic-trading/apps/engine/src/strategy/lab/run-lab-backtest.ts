/**
 * Lab 백테스트 오케스트레이터
 * DB → candles 로드 → strategy.generateSignals → simulatePortfolio → result
 */
import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import type { Candle } from '@trading/shared/types';
import type {
  LabBacktestConfig,
  LabBacktestResult,
  LabCostParams
} from './types.js';
import { getStrategy } from './registry.js';
import { simulatePortfolio } from './simulate.js';

const DEFAULT_COST_PARAMS: LabCostParams = {
  slippageRate: 0.001, // 0.1%
  feeRate: 0.00015, // 매수·매도 각 0.015%
  taxRate: 0.0018 // 거래세 0.18%
};

/** 캔들 로드 — universe + date window + lookback만 */
function loadCandles(
  db: Database.Database,
  stockCodes: string[],
  startDate: string,
  endDate: string,
  lookback: number
): { stockCandles: Map<string, Candle[]>; allDates: string[] } {
  // lookback일 전 날짜 계산 (DB에서 바로 처리)
  const lookbackDate = db
    .prepare(
      `SELECT date FROM daily_candles
     WHERE date < ? GROUP BY date ORDER BY date DESC LIMIT 1 OFFSET ?`
    )
    .get(startDate, lookback - 1) as { date: string } | undefined;
  const actualStart = lookbackDate?.date ?? startDate;

  const placeholders = stockCodes.map(() => '?').join(',');

  // 거래일 목록
  const allDates = (
    db
      .prepare(
        `SELECT DISTINCT date FROM daily_candles
     WHERE stock_code IN (${placeholders}) AND date >= ? AND date <= ?
     ORDER BY date ASC`
      )
      .all(...stockCodes, actualStart, endDate) as { date: string }[]
  ).map((r) => r.date);

  // 종목별 캔들
  const stockCandles = new Map<string, Candle[]>();
  const stmt = db.prepare(
    `SELECT stock_code AS stockCode, date, open, high, low, close, adj_close AS adjClose, volume, amount
     FROM daily_candles
     WHERE stock_code = ? AND date >= ? AND date <= ?
     ORDER BY date ASC`
  );

  for (const code of stockCodes) {
    const candles = stmt.all(code, actualStart, endDate) as Candle[];
    if (candles.length > 0) {
      stockCandles.set(code, candles);
    }
  }

  return { stockCandles, allDates };
}

/** run_id 생성 (재현성 보장) */
function generateRunId(config: LabBacktestConfig): string {
  const hash = createHash('sha256');
  hash.update(
    JSON.stringify({
      algorithmId: config.algorithmId,
      strategyType: config.strategyType,
      params: config.params,
      riskParams: config.riskParams,
      stockCodes: [...config.stockCodes].sort(),
      startDate: config.startDate,
      endDate: config.endDate,
      initialCapital: config.initialCapital,
      costParams: config.costParams,
      executionPrice: config.executionPrice
    })
  );
  return hash.digest('hex').slice(0, 32);
}

export function runLabBacktest(
  db: Database.Database,
  config: LabBacktestConfig
): LabBacktestResult {
  const strategy = getStrategy(config.strategyType);
  if (!strategy) {
    throw new Error(`Unknown strategy type: ${config.strategyType}`);
  }

  // lookback 계산 — 전략 인터페이스의 minLookback() 사용 (문자열 휴리스틱 제거)
  const lookback = strategy.minLookback(config.params);

  // 캔들 로드
  const { stockCandles, allDates } = loadCandles(
    db,
    config.stockCodes,
    config.startDate,
    config.endDate,
    lookback
  );

  if (allDates.length === 0) {
    throw new Error('No trading days found in the given date range');
  }

  // 시그널 생성 (warm-up 포함 전체 날짜로 지표 계산)
  const signals = strategy.generateSignals(
    stockCandles,
    allDates,
    config.params
  );

  // 시뮬레이션 구간 결정 — startDate 이후만
  const startIdx = allDates.findIndex((d) => d >= config.startDate);
  if (startIdx < 0) {
    throw new Error('No trading days found in the given date range');
  }
  const simDates = allDates.slice(startIdx);

  // warm-up 마지막 날 시그널 → startDate 첫 거래일에 T+1 체결
  // simDates에 warm-up을 넣지 않고 initialPending으로 주입하여 메트릭 오염 방지
  const warmupLastDay = startIdx > 0 ? allDates[startIdx - 1] : undefined;
  const initialPendingBuy = warmupLastDay
    ? (signals.buy.get(warmupLastDay) ?? [])
    : [];
  const initialPendingSell = warmupLastDay
    ? (signals.sell.get(warmupLastDay) ?? new Set<string>())
    : new Set<string>();

  // 포트폴리오 시뮬레이션
  const costParams: LabCostParams = {
    ...DEFAULT_COST_PARAMS,
    ...config.costParams
  };

  const result = simulatePortfolio({
    buySignals: signals.buy,
    sellSignals: signals.sell,
    stockCandles,
    allDates: simDates,
    initialCapital: config.initialCapital,
    riskParams: config.riskParams,
    costParams,
    initialPendingBuy,
    initialPendingSell,
    executionDelay: config.executionDelay,
    executionPrice: config.executionPrice
  });

  return {
    runId: generateRunId(config),
    algorithmId: config.algorithmId,
    strategyType: config.strategyType,
    name: config.name,
    params: config.params,
    riskParams: config.riskParams,
    costParams,
    stockCodes: config.stockCodes,
    startDate: config.startDate,
    endDate: config.endDate,
    initialCapital: config.initialCapital,
    executionModel: 'daily',
    ...result,
    createdAt: new Date().toISOString()
  };
}
