/**
 * Lab 포트폴리오 시뮬레이터
 * optimize-strategies.ts의 simulatePortfolio()를 기반으로,
 * full trades[] + equityCurve[] 반환하도록 확장.
 * 모든 외부 의존성을 함수 인자로 받아 순수 함수로 동작.
 */
import type { Candle } from '@trading/shared/types';
import type {
  RankedSignal,
  LabTradeRecord,
  LabEquityPoint,
  LabRiskParams,
  LabCostParams
} from './types.js';

interface Position {
  stockCode: string;
  buyDate: string;
  buyDateIdx: number;
  buyPrice: number;
  quantity: number;
  cost: number;
}

export interface SimulationConfig {
  buySignals: Map<string, RankedSignal[]>;
  sellSignals: Map<string, Set<string>>;
  stockCandles: Map<string, Candle[]>;
  allDates: string[];
  initialCapital: number;
  riskParams: LabRiskParams;
  costParams: LabCostParams;
  /** warm-up 마지막 날 시그널 → allDates[0] T+1 체결용 (orchestrator가 주입) */
  initialPendingBuy?: RankedSignal[];
  initialPendingSell?: Set<string>;
  /** 체결 지연 일수. 기본 1 (T+1). 강건성 테스트에서 2 이상으로 설정. */
  executionDelay?: number;
  /** 체결 가격 모델. 기본 'open' (시가). 'vwap'은 (H+L+C)/3 근사. */
  executionPrice?: 'open' | 'vwap';
}

export interface SimulationResult {
  totalReturn: number;
  cagr: number;
  mdd: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  totalTrades: number;
  avgHoldDays: number;
  trades: LabTradeRecord[];
  equityCurve: LabEquityPoint[];
}

/** 종목 캔들에서 종가 추출 (수정주가 우선) */
function getClose(c: Candle): number {
  return c.adjClose ?? c.close;
}

/** 특정 날짜의 캔들 인덱스 찾기 (binary search) */
function findDateIndex(candles: Candle[], date: string): number {
  let lo = 0;
  let hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const d = candles[mid]!.date;
    if (d === date) return mid;
    if (d < date) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/** 현금 보유 비율 (5%를 항상 보유하여 수수료/세금 여유분 확보) */
const CASH_RESERVE_RATE = 0.05;

export function simulatePortfolio(config: SimulationConfig): SimulationResult {
  const {
    buySignals,
    sellSignals,
    stockCandles,
    allDates,
    initialCapital,
    riskParams: {
      stopLossRate,
      takeProfitRate,
      maxHoldDays,
      maxPositions,
      maxWeight
    },
    costParams: { slippageRate, feeRate, taxRate }
  } = config;

  let cash = initialCapital;
  const positions = new Map<string, Position>();
  const trades: LabTradeRecord[] = [];
  const equityCurve: LabEquityPoint[] = [];
  let peak = initialCapital;
  let maxDD = 0;

  const priceModel = config.executionPrice ?? 'open';
  /** 체결 기준가 계산 */
  function execPrice(candle: Candle): number {
    if (priceModel === 'vwap')
      return (candle.high + candle.low + candle.close) / 3;
    return candle.open;
  }

  // 시그널 타이밍 계약: 시그널은 "관찰일"에 기록되고, delay 거래일 후 체결.
  // executionDelay=1 이면 T+1 (기본), executionDelay=2 이면 T+2.
  // 큐로 구현하여 임의 지연을 지원.
  const delay = config.executionDelay ?? 1;
  const buyQueue: RankedSignal[][] = Array.from({ length: delay }, () => []);
  const sellQueue: Set<string>[] = Array.from(
    { length: delay },
    () => new Set()
  );
  // initialPending은 delay=1 위치에 삽입 (다음 날 체결)
  if (config.initialPendingBuy?.length) {
    buyQueue[0] = config.initialPendingBuy;
  }
  if (config.initialPendingSell?.size) {
    sellQueue[0] = config.initialPendingSell;
  }

  for (let di = 0; di < allDates.length; di++) {
    const date = allDates[di]!;

    // 0. 큐에서 오늘 체결할 시그널 꺼내기
    const todayBuy = buyQueue.shift()!;
    const todaySell = sellQueue.shift()!;
    // 오늘 관찰한 시그널은 delay일 후 체결
    buyQueue.push(buySignals.get(date) ?? []);
    sellQueue.push(sellSignals.get(date) ?? new Set());

    // 1. 매도 체크 (기존 포지션)
    for (const [code, pos] of [...positions.entries()]) {
      const candles = stockCandles.get(code);
      if (!candles) continue;
      const todayIdx = findDateIndex(candles, date);
      if (todayIdx < 0) continue;
      const today = candles[todayIdx]!;
      const holdDays = di - pos.buyDateIdx;

      let sell = false;
      const basePrice = execPrice(today);
      let sellPrice = basePrice;
      let reason = '';

      // 손절 (갭다운 시 시가 체결, 장중 도달 시 타겟가 체결)
      if (stopLossRate < 0 && today.low <= pos.buyPrice * (1 + stopLossRate)) {
        sellPrice = Math.min(basePrice, pos.buyPrice * (1 + stopLossRate));
        sell = true;
        reason = 'stop_loss';
      }
      // 익절
      else if (
        takeProfitRate > 0 &&
        today.high >= pos.buyPrice * (1 + takeProfitRate)
      ) {
        const target = pos.buyPrice * (1 + takeProfitRate);
        sellPrice = Math.max(basePrice, target);
        sell = true;
        reason = 'take_profit';
      }
      // 매도 시그널 (전일 관찰 → 오늘 체결)
      else if (todaySell.has(code)) {
        sellPrice = basePrice;
        sell = true;
        reason = 'exit_signal';
      }
      // 최대 보유일 초과
      else if (maxHoldDays > 0 && holdDays >= maxHoldDays) {
        sellPrice = basePrice;
        sell = true;
        reason = 'max_hold';
      }

      if (sell) {
        const sp = sellPrice * (1 - slippageRate);
        const amount = sp * pos.quantity;
        const fee = amount * feeRate;
        const tax = amount * taxRate;
        const net = amount - fee - tax;
        const pnl = net - pos.cost;
        const pnlRate = pos.cost > 0 ? pnl / pos.cost : 0;

        trades.push({
          stockCode: code,
          buyDate: pos.buyDate,
          sellDate: date,
          buyPrice: pos.buyPrice,
          sellPrice: sp,
          quantity: pos.quantity,
          pnl,
          pnlRate,
          fee: fee + (pos.cost - pos.buyPrice * pos.quantity), // 매도 수수료 + 매수 수수료
          tax,
          holdDays,
          reason
        });
        cash += net;
        positions.delete(code);
      }
    }

    // 2. 매수 체크 (전일 시그널 → 오늘 시가 체결, 랭킹 순)
    if (todayBuy.length > 0 && positions.size < maxPositions) {
      for (const { stockCode: code } of todayBuy) {
        if (positions.has(code)) continue;
        if (positions.size >= maxPositions) break;

        const candles = stockCandles.get(code);
        if (!candles) continue;
        const todayIdx = findDateIndex(candles, date);
        if (todayIdx < 0) continue;
        const today = candles[todayIdx]!;

        // 총 평가액 계산
        let stockValue = 0;
        for (const p of positions.values()) {
          const pc = stockCandles.get(p.stockCode);
          if (!pc) continue;
          const pi = findDateIndex(pc, date);
          const price = pi >= 0 ? getClose(pc[pi]!) : p.buyPrice;
          stockValue += price * p.quantity;
        }
        const totalEquity = cash + stockValue;
        const ep = execPrice(today);
        const maxAmount = Math.min(
          totalEquity * maxWeight,
          cash * (1 - CASH_RESERVE_RATE)
        );
        if (maxAmount < ep * 2) continue;

        const buyPrice = ep * (1 + slippageRate);
        const quantity = Math.floor(maxAmount / buyPrice);
        if (quantity <= 0) continue;

        const amount = buyPrice * quantity;
        const fee = amount * feeRate;
        const cost = amount + fee;
        if (cost > cash) continue;

        cash -= cost;
        positions.set(code, {
          stockCode: code,
          buyDate: date,
          buyDateIdx: di,
          buyPrice,
          quantity,
          cost
        });
      }
    }

    // 3. 에쿼티 기록
    let stockValue = 0;
    for (const pos of positions.values()) {
      const candles = stockCandles.get(pos.stockCode);
      if (!candles) continue;
      const tidx = findDateIndex(candles, date);
      const price = tidx >= 0 ? getClose(candles[tidx]!) : pos.buyPrice;
      stockValue += price * pos.quantity;
    }
    const equity = cash + stockValue;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDD) maxDD = dd;

    equityCurve.push({ date, equity, drawdown: dd });
  }

  // 미청산 포지션 강제 청산
  for (const [code, pos] of positions) {
    const candles = stockCandles.get(code);
    const lastCandle = candles?.[candles.length - 1];
    const sellPrice =
      (lastCandle ? getClose(lastCandle) : pos.buyPrice) * (1 - slippageRate);
    const amount = sellPrice * pos.quantity;
    const fee = amount * feeRate;
    const tax = amount * taxRate;
    const net = amount - fee - tax;
    const pnl = net - pos.cost;
    const holdDays = allDates.length - pos.buyDateIdx;

    trades.push({
      stockCode: code,
      buyDate: pos.buyDate,
      sellDate: allDates[allDates.length - 1] ?? '',
      buyPrice: pos.buyPrice,
      sellPrice,
      quantity: pos.quantity,
      pnl,
      pnlRate: pos.cost > 0 ? pnl / pos.cost : 0,
      fee: fee + (pos.cost - pos.buyPrice * pos.quantity),
      tax,
      holdDays,
      reason: 'force_liquidate'
    });
    cash += net;
  }
  positions.clear();

  // 메트릭 계산
  const finalEquity = cash;
  const totalReturn = (finalEquity - initialCapital) / initialCapital;
  // CAGR: equityCurve의 실제 거래일 수 기준 (lookback 포함 allDates가 아닌 equityCurve 길이)
  const tradingDays = equityCurve.length;
  const years = tradingDays / 252;
  const cagr =
    years > 0
      ? Math.pow(Math.max(finalEquity, 0) / initialCapital, 1 / years) - 1
      : 0;

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const totalProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor =
    totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99 : 0;

  // Sharpe ratio
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1]!.equity;
    if (prev > 0) dailyReturns.push((equityCurve[i]!.equity - prev) / prev);
  }
  let sharpeRatio = 0;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) /
      (dailyReturns.length - 1);
    sharpeRatio =
      variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;
  }

  const avgHoldDays =
    trades.length > 0
      ? trades.reduce((s, t) => s + t.holdDays, 0) / trades.length
      : 0;

  return {
    totalReturn,
    cagr,
    mdd: maxDD,
    winRate,
    profitFactor,
    sharpeRatio,
    totalTrades: trades.length,
    avgHoldDays,
    trades,
    equityCurve
  };
}
