import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  StrategyParams,
  RiskParams,
  Candle,
  MinuteCandle,
  Market
} from '@trading/shared/types';
import {
  adjustBuyPrice,
  adjustSellPrice,
  PRICE_LIMIT_RATE,
  DEFAULT_FEE_RULES
} from '@trading/shared/constants';
import { sma, rsi } from './indicators.js';

const PKG_VERSION = '0.0.1';

// ── 타입 정의 ──

export interface BacktestConfig {
  name: string;
  strategyParams: StrategyParams;
  riskParams: RiskParams;
  stockCodes: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  initialCapital: number;
  slippageRate?: number; // 기본 0.001
  participationRate?: number; // 기본 0.01
  stockMarkets?: Record<string, Market>; // 종목별 시장 구분 (기본 KOSPI)
}

export interface TradeRecord {
  stockCode: string;
  buyDatetime: string;
  sellDatetime: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  pnl: number;
  pnlRate: number;
  fee: number;
  tax: number;
  reason: string;
}

export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

export interface BacktestResult {
  runId: string;
  name: string;
  startDate: string;
  endDate: string;
  params: StrategyParams;
  costParams: {
    slippageRate: number;
    participationRate: number;
    feeRules: string;
  };
  totalReturn: number;
  cagr: number;
  mdd: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  totalTrades: number;
  trades: TradeRecord[];
  equityCurve: EquityPoint[];
}

// ── 내부 포지션 추적 ──

interface OpenPosition {
  stockCode: string;
  quantity: number;
  buyPrice: number;
  buyDatetime: string;
  buyCost: number; // 수수료 포함 총 비용
}

// ── 비용 계산 ──

function calcBuyCost(amount: number, market: Market): number {
  const rules = DEFAULT_FEE_RULES.filter(
    (r) => r.market === market && r.feeType === 'BROKER_BUY'
  );
  let fee = 0;
  for (const r of rules) fee += amount * r.rate;
  return fee;
}

function calcSellCost(
  amount: number,
  market: Market
): { fee: number; tax: number } {
  const rules = DEFAULT_FEE_RULES.filter((r) => r.market === market);
  let fee = 0;
  let tax = 0;
  for (const r of rules) {
    if (r.feeType === 'BROKER_SELL') fee += amount * r.rate;
    if (r.feeType === 'TAX' || r.feeType === 'SPECIAL_TAX')
      tax += amount * r.rate;
  }
  return { fee, tax };
}

// ── run_id 생성 ──

function generateRunId(config: BacktestConfig): string {
  const payload = JSON.stringify({
    params: config.strategyParams,
    stockCodes: config.stockCodes,
    startDate: config.startDate,
    endDate: config.endDate,
    version: PKG_VERSION
  });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

// ── 메트릭 계산 ──

function calcMetrics(
  trades: TradeRecord[],
  equityCurve: EquityPoint[],
  initialCapital: number,
  startDate: string,
  endDate: string
): {
  totalReturn: number;
  cagr: number;
  mdd: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
} {
  const lastPoint = equityCurve[equityCurve.length - 1];
  const finalEquity = lastPoint ? lastPoint.equity : initialCapital;
  const totalReturn = (finalEquity - initialCapital) / initialCapital;

  // CAGR
  const msPerDay = 86400000;
  const days =
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / msPerDay;
  const years = days / 365;
  const cagr =
    years > 0 ? Math.pow(finalEquity / initialCapital, 1 / years) - 1 : 0;

  // MDD
  let peak = initialCapital;
  let mdd = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = (peak - point.equity) / peak;
    if (dd > mdd) mdd = dd;
  }

  // Win rate, profit factor
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;

  const totalProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor =
    totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  // Sharpe ratio (risk-free rate = 0)
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEq = equityCurve[i - 1]!.equity;
    if (prevEq > 0) {
      dailyReturns.push((equityCurve[i]!.equity - prevEq) / prevEq);
    }
  }
  let sharpeRatio = 0;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) /
      (dailyReturns.length - 1);
    const std = Math.sqrt(variance);
    sharpeRatio = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
  }

  return { totalReturn, cagr, mdd, winRate, profitFactor, sharpeRatio };
}

// ── 메인 백테스트 함수 ──

export function runBacktest(
  db: Database.Database,
  config: BacktestConfig
): BacktestResult {
  const {
    strategyParams: params,
    riskParams,
    stockCodes,
    startDate,
    endDate,
    initialCapital
  } = config;
  const slippageRate = config.slippageRate ?? 0.001;
  const participationRate = config.participationRate ?? 0.01;
  const stockMarkets = config.stockMarkets ?? {};

  const getMarket = (code: string): Market => stockMarkets[code] ?? 'KOSPI';

  // 지표 계산에 필요한 lookback 기간 (최대 MA period + 여유분)
  const lookbackDays = Math.max(params.longMaPeriod, params.rsiPeriod, 20) + 10;

  // Prepared statements
  const getDailyCandles = db.prepare<[string, string, number]>(
    `SELECT stock_code AS stockCode, date, open, high, low, close, adj_close AS adjClose, volume, amount
     FROM daily_candles
     WHERE stock_code = ? AND date <= ?
     ORDER BY date DESC LIMIT ?`
  );

  const getMinuteCandles = db.prepare<[string, string]>(
    `SELECT stock_code AS stockCode, datetime, open, high, low, close, volume
     FROM minute_candles
     WHERE stock_code = ? AND datetime LIKE ? || '%'
     ORDER BY datetime ASC`
  );

  const getTradingDays = db.prepare<[string, string, string]>(
    `SELECT DISTINCT date FROM daily_candles
     WHERE stock_code = ? AND date >= ? AND date <= ?
     ORDER BY date ASC`
  );

  // 상태 추적
  const trades: TradeRecord[] = [];
  const equityCurve: EquityPoint[] = [];
  let cash = initialCapital;
  let runningPeak = initialCapital; // MDD 계산용 고점 추적
  const positions = new Map<string, OpenPosition>();

  // 거래일 목록 (전 종목 UNION으로 거래일 결정)
  if (stockCodes.length === 0) {
    return buildEmptyResult(
      config,
      generateRunId(config),
      slippageRate,
      participationRate
    );
  }

  const tradingDaysStmt = db.prepare(
    `SELECT DISTINCT date FROM daily_candles
     WHERE stock_code IN (${stockCodes.map(() => '?').join(',')}) AND date >= ? AND date <= ?
     ORDER BY date ASC`
  );
  const tradingDays = tradingDaysStmt.all(
    ...stockCodes,
    startDate,
    endDate
  ) as { date: string }[];

  // 일봉 캐시: stockCode → date → Candle (에쿼티 평가 시 재사용)
  const dailyCandleCache = new Map<string, Candle>();

  for (const { date } of tradingDays) {
    // 종목별 일봉 및 지표 계산
    for (const stockCode of stockCodes) {
      // 일봉 가져오기 (lookback 포함)
      const dailyRows = getDailyCandles.all(
        stockCode,
        date,
        lookbackDays
      ) as Candle[];
      if (dailyRows.length === 0) continue;

      // 시간 순으로 정렬 (DB는 DESC로 가져옴)
      const dailyCandles = dailyRows.reverse();

      // 당일 종가를 캐시에 저장 (에쿼티 평가용)
      const todayCandleForCache = dailyCandles.find((c) => c.date === date);
      if (todayCandleForCache) {
        dailyCandleCache.set(`${stockCode}:${date}`, todayCandleForCache);
      }

      // 전일 데이터
      const todayIdx = dailyCandles.findIndex((c) => c.date === date);
      if (todayIdx < 1) continue; // 전일 데이터 없으면 스킵

      const prevCandle = dailyCandles[todayIdx - 1]!;
      const todayCandle = dailyCandles[todayIdx]!;
      const prevRange = prevCandle.high - prevCandle.low;
      const prevClose = prevCandle.adjClose ?? prevCandle.close;

      // 상하한가
      const upperLimit = Math.floor(prevClose * (1 + PRICE_LIMIT_RATE));
      const lowerLimit = Math.ceil(prevClose * (1 - PRICE_LIMIT_RATE));

      // 전일 거래량 (참여율 제한)
      const prevVolume = prevCandle.volume;

      // 지표 계산 (당일 포함 이전 N일 일봉 기준)
      // NOTE: 일봉 기준 MA/RSI를 분봉 매매 판단에 사용하는 것은 의도된 설계.
      // 일중 변동이 아닌 일간 추세를 기반으로 매매 신호를 생성한다.
      const indicatorCandles = dailyCandles.slice(0, todayIdx + 1);
      const shortMaValues = sma(indicatorCandles, params.shortMaPeriod);
      const longMaValues = sma(indicatorCandles, params.longMaPeriod);
      const rsiValues = rsi(indicatorCandles, params.rsiPeriod);

      const lastIdx = indicatorCandles.length - 1;
      const shortMa = shortMaValues[lastIdx] ?? null;
      const longMa = longMaValues[lastIdx] ?? null;
      const currentRsi = rsiValues[lastIdx] ?? null;

      // 분봉 조회 (없으면 일봉 전용 시뮬레이션)
      const minuteCandles = getMinuteCandles.all(
        stockCode,
        date
      ) as MinuteCandle[];

      if (minuteCandles.length === 0) {
        // ── 일봉 전용 시뮬레이션 (변동성 돌파 전략) ──
        // 매수: 당일 고가 ≥ 시가 + K × 전일레인지 → 돌파 가격에 매수
        // 매도: 익일 시가 청산 (기본) / 당일 손절·익절 가능
        const market = getMarket(stockCode);
        const existingPos = positions.get(stockCode);

        // (1) 기존 포지션 → 익일 시가 매도
        if (existingPos) {
          const stopPrice = existingPos.buyPrice * (1 + params.stopLossRate);
          const takeProfitPrice =
            existingPos.buyPrice * (1 + params.takeProfitRate);

          let sellReason: string;
          let rawSellPrice: number;

          if (todayCandle.open <= stopPrice) {
            sellReason = 'stop_loss'; // 갭다운
            rawSellPrice = todayCandle.open;
          } else if (todayCandle.open >= takeProfitPrice) {
            sellReason = 'take_profit'; // 갭업
            rawSellPrice = todayCandle.open;
          } else {
            sellReason = 'time_close'; // 기본: 익일 시가 청산
            rawSellPrice = todayCandle.open;
          }

          let sellPrice = adjustSellPrice(rawSellPrice * (1 - slippageRate));
          if (sellPrice < lowerLimit) sellPrice = lowerLimit;

          const sellAmount = sellPrice * existingPos.quantity;
          const { fee: sellFee, tax: sellTax } = calcSellCost(
            sellAmount,
            market
          );
          const sellNet = sellAmount - sellFee - sellTax;
          const pnl = sellNet - existingPos.buyCost;
          const pnlRate =
            existingPos.buyCost > 0 ? pnl / existingPos.buyCost : 0;

          trades.push({
            stockCode,
            buyDatetime: existingPos.buyDatetime,
            sellDatetime: `${date} 09:00`,
            buyPrice: existingPos.buyPrice,
            sellPrice,
            quantity: existingPos.quantity,
            pnl,
            pnlRate,
            fee:
              calcBuyCost(existingPos.buyPrice * existingPos.quantity, market) +
              sellFee,
            tax: sellTax,
            reason: sellReason
          });

          cash += sellNet;
          positions.delete(stockCode);
        }

        // (2) 매수 조건 확인
        if (
          !positions.has(stockCode) &&
          positions.size < riskParams.maxPositions &&
          shortMa !== null &&
          longMa !== null &&
          currentRsi !== null
        ) {
          const breakoutThreshold = todayCandle.open + prevRange * params.k;

          const isBuySignal =
            todayCandle.high >= breakoutThreshold &&
            shortMa > longMa &&
            currentRsi >= params.rsiLow &&
            currentRsi <= params.rsiHigh;

          if (isBuySignal) {
            let buyPrice = breakoutThreshold * (1 + slippageRate);
            buyPrice = adjustBuyPrice(buyPrice);

            if (buyPrice < upperLimit) {
              const maxQuantity = Math.floor(prevVolume * participationRate);

              if (maxQuantity > 0) {
                const totalEquity =
                  cash +
                  Array.from(positions.values()).reduce(
                    (s, p) => s + p.buyPrice * p.quantity,
                    0
                  );
                const maxAmount = totalEquity * riskParams.maxPositionWeight;
                let quantity = Math.min(
                  maxQuantity,
                  Math.floor(maxAmount / buyPrice)
                );

                if (quantity > 0) {
                  const buyAmount = buyPrice * quantity;
                  const buyFee = calcBuyCost(buyAmount, market);
                  const totalCost = buyAmount + buyFee;

                  if (totalCost > cash) {
                    const feeRate = buyAmount > 0 ? buyFee / buyAmount : 0;
                    quantity = Math.floor(cash / (buyPrice * (1 + feeRate)));
                  }

                  if (quantity > 0) {
                    const finalBuyAmount = buyPrice * quantity;
                    const finalBuyFee = calcBuyCost(finalBuyAmount, market);
                    const finalTotalCost = finalBuyAmount + finalBuyFee;

                    cash -= finalTotalCost;
                    positions.set(stockCode, {
                      stockCode,
                      quantity,
                      buyPrice,
                      buyDatetime: `${date} 09:30`,
                      buyCost: finalTotalCost
                    });

                    // (3) 당일 손절/익절 체크
                    const newPos = positions.get(stockCode)!;
                    const stopPrice =
                      newPos.buyPrice * (1 + params.stopLossRate);
                    const takeProfitPrice =
                      newPos.buyPrice * (1 + params.takeProfitRate);
                    const sameDayStop = todayCandle.low <= stopPrice;
                    const sameDayTakeProfit =
                      todayCandle.high >= takeProfitPrice;

                    if (sameDayStop || sameDayTakeProfit) {
                      // 손절 우선 (보수적)
                      const exitReason = sameDayStop
                        ? 'stop_loss'
                        : 'take_profit';
                      const exitRawPrice = sameDayStop
                        ? stopPrice
                        : takeProfitPrice;

                      let exitPrice = adjustSellPrice(
                        exitRawPrice * (1 - slippageRate)
                      );
                      if (exitPrice < lowerLimit) exitPrice = lowerLimit;

                      const exitAmount = exitPrice * newPos.quantity;
                      const { fee: exitFee, tax: exitTax } = calcSellCost(
                        exitAmount,
                        market
                      );
                      const exitNet = exitAmount - exitFee - exitTax;
                      const exitPnl = exitNet - newPos.buyCost;
                      const exitPnlRate =
                        newPos.buyCost > 0 ? exitPnl / newPos.buyCost : 0;

                      trades.push({
                        stockCode,
                        buyDatetime: newPos.buyDatetime,
                        sellDatetime: `${date} 15:00`,
                        buyPrice: newPos.buyPrice,
                        sellPrice: exitPrice,
                        quantity: newPos.quantity,
                        pnl: exitPnl,
                        pnlRate: exitPnlRate,
                        fee:
                          calcBuyCost(
                            newPos.buyPrice * newPos.quantity,
                            market
                          ) + exitFee,
                        tax: exitTax,
                        reason: exitReason
                      });

                      cash += exitNet;
                      positions.delete(stockCode);
                    }
                  }
                }
              }
            }
          }
        }

        continue; // 분봉 순회 스킵
      }

      for (const mc of minuteCandles) {
        const time = mc.datetime.slice(11); // HH:MM
        const currentPrice = mc.close;
        const market = getMarket(stockCode);
        const existingPos = positions.get(stockCode);

        // ── 매도 로직 (보유 중일 때) ──
        if (existingPos) {
          let sellReason = '';
          let sellTriggered = false;

          // 1. 손절 (stopLossRate는 음수: -0.05 = -5% 하락 시 손절)
          if (
            currentPrice <=
            existingPos.buyPrice * (1 + params.stopLossRate)
          ) {
            sellReason = 'stop_loss';
            sellTriggered = true;
          }
          // 2. 익절
          else if (
            currentPrice >=
            existingPos.buyPrice * (1 + params.takeProfitRate)
          ) {
            sellReason = 'take_profit';
            sellTriggered = true;
          }
          // 3. RSI 과매수
          else if (currentRsi !== null && currentRsi > params.rsiHigh) {
            sellReason = 'rsi_overbought';
            sellTriggered = true;
          }
          // 4. MA 데드크로스
          else if (shortMa !== null && longMa !== null && shortMa < longMa) {
            sellReason = 'ma_dead_cross';
            sellTriggered = true;
          }
          // 5. 시간 청산
          else if (time >= params.closingTime) {
            sellReason = 'time_close';
            sellTriggered = true;
          }

          if (sellTriggered) {
            // 슬리피지 적용 (매도 시 하락)
            let sellPrice = currentPrice * (1 - slippageRate);
            sellPrice = adjustSellPrice(sellPrice);

            // 하한가 체크: 하한가 아래면 하한가에 체결
            if (sellPrice < lowerLimit) {
              sellPrice = lowerLimit;
            }

            const sellAmount = sellPrice * existingPos.quantity;
            const { fee: sellFee, tax: sellTax } = calcSellCost(
              sellAmount,
              market
            );

            const buyTotalCost = existingPos.buyCost;
            const sellNet = sellAmount - sellFee - sellTax;
            const pnl = sellNet - buyTotalCost;
            const pnlRate = buyTotalCost > 0 ? pnl / buyTotalCost : 0;

            trades.push({
              stockCode,
              buyDatetime: existingPos.buyDatetime,
              sellDatetime: mc.datetime,
              buyPrice: existingPos.buyPrice,
              sellPrice,
              quantity: existingPos.quantity,
              pnl,
              pnlRate,
              fee:
                calcBuyCost(
                  existingPos.buyPrice * existingPos.quantity,
                  market
                ) + sellFee,
              tax: sellTax,
              reason: sellReason
            });

            cash += sellNet;
            positions.delete(stockCode);
          }
          continue; // 보유 중이면 매수 로직 스킵
        }

        // ── 매수 로직 ──
        if (time >= params.closingTime) continue; // 청산 시간 이후 매수 불가

        // 포지션 수 제한
        if (positions.size >= riskParams.maxPositions) continue;

        // 지표 데이터 불충분
        if (shortMa === null || longMa === null || currentRsi === null)
          continue;

        // 매수 조건: 변동성 돌파 + MA 골든크로스 + RSI 필터
        const breakoutThreshold = todayCandle.open + prevRange * params.k;
        const isBuySignal =
          currentPrice > breakoutThreshold &&
          shortMa > longMa &&
          currentRsi >= params.rsiLow &&
          currentRsi <= params.rsiHigh;

        if (!isBuySignal) continue;

        // 슬리피지 적용 (매수 시 상승)
        let buyPrice = currentPrice * (1 + slippageRate);
        buyPrice = adjustBuyPrice(buyPrice);

        // 상한가 체크: 상한가 이상이면 매수 불가
        if (buyPrice >= upperLimit) continue;

        // 참여율 제한
        const maxQuantity = Math.floor(prevVolume * participationRate);
        if (maxQuantity <= 0) continue;

        // 종목당 최대 비중
        const totalEquity =
          cash +
          Array.from(positions.values()).reduce(
            (s, p) => s + p.buyPrice * p.quantity,
            0
          );
        const maxAmount = totalEquity * riskParams.maxPositionWeight;
        let quantity = Math.min(maxQuantity, Math.floor(maxAmount / buyPrice));
        if (quantity <= 0) continue;

        // 현금 부족 체크: 수수료 포함 총 비용이 현금 초과 시 수량 재계산
        const buyAmount = buyPrice * quantity;
        const buyFee = calcBuyCost(buyAmount, market);
        const totalCost = buyAmount + buyFee;

        if (totalCost > cash) {
          // 수수료 비율을 이용해 현금 내에서 가능한 최대 수량 산출
          // totalCost = buyPrice * q * (1 + feeRate) <= cash
          const feeRate = buyAmount > 0 ? buyFee / buyAmount : 0;
          quantity = Math.floor(cash / (buyPrice * (1 + feeRate)));
          if (quantity <= 0) continue;
        }

        const finalBuyAmount = buyPrice * quantity;
        const finalBuyFee = calcBuyCost(finalBuyAmount, market);
        const finalTotalCost = finalBuyAmount + finalBuyFee;

        cash -= finalTotalCost;
        positions.set(stockCode, {
          stockCode,
          quantity,
          buyPrice,
          buyDatetime: mc.datetime,
          buyCost: finalTotalCost
        });
      }
    }

    // 일말 에쿼티 기록 (캐시된 일봉 사용)
    let stockValue = 0;
    for (const pos of positions.values()) {
      const cached = dailyCandleCache.get(`${pos.stockCode}:${date}`);
      const closePrice = cached
        ? (cached.adjClose ?? cached.close)
        : pos.buyPrice;
      stockValue += closePrice * pos.quantity;
    }

    const equity = cash + stockValue;
    if (equity > runningPeak) runningPeak = equity;
    const drawdown = runningPeak > 0 ? (runningPeak - equity) / runningPeak : 0;

    equityCurve.push({ date, equity, drawdown });
  }

  // 마지막 거래일 이후 미청산 포지션 강제 청산
  for (const [stockCode, pos] of positions) {
    const lastDay = tradingDays[tradingDays.length - 1];
    const lastDate = lastDay ? lastDay.date : endDate;
    const dailyRows = getDailyCandles.all(stockCode, lastDate, 1) as Candle[];
    const row = dailyRows[0];
    const closePrice = row ? (row.adjClose ?? row.close) : pos.buyPrice;
    const market = getMarket(stockCode);

    const sellAmount = closePrice * pos.quantity;
    const { fee: sellFee, tax: sellTax } = calcSellCost(sellAmount, market);
    const sellNet = sellAmount - sellFee - sellTax;
    const pnl = sellNet - pos.buyCost;
    const pnlRate = pos.buyCost > 0 ? pnl / pos.buyCost : 0;

    trades.push({
      stockCode,
      buyDatetime: pos.buyDatetime,
      sellDatetime: `${lastDate} 15:30`,
      buyPrice: pos.buyPrice,
      sellPrice: closePrice,
      quantity: pos.quantity,
      pnl,
      pnlRate,
      fee: calcBuyCost(pos.buyPrice * pos.quantity, market) + sellFee,
      tax: sellTax,
      reason: 'end_of_backtest'
    });

    cash += sellNet;
  }
  positions.clear();

  // 메트릭 계산
  const metrics = calcMetrics(
    trades,
    equityCurve,
    initialCapital,
    startDate,
    endDate
  );
  const runId = generateRunId(config);

  return {
    runId,
    name: config.name,
    startDate,
    endDate,
    params: config.strategyParams,
    costParams: {
      slippageRate,
      participationRate,
      feeRules: 'DEFAULT_FEE_RULES'
    },
    ...metrics,
    totalTrades: trades.length,
    trades,
    equityCurve
  };
}

/** 결과를 DB에 저장 */
export function saveBacktestResult(
  db: Database.Database,
  result: BacktestResult
): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO backtest_results
      (run_id, name, params, cost_params, start_date, end_date,
       total_return, cagr, mdd, win_rate, profit_factor, sharpe_ratio,
       total_trades, trades_detail, equity_curve)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    result.runId,
    result.name,
    JSON.stringify(result.params),
    JSON.stringify(result.costParams),
    result.startDate,
    result.endDate,
    result.totalReturn,
    result.cagr,
    result.mdd,
    result.winRate,
    result.profitFactor,
    result.sharpeRatio,
    result.totalTrades,
    JSON.stringify(result.trades),
    JSON.stringify(result.equityCurve)
  );
}

function buildEmptyResult(
  config: BacktestConfig,
  runId: string,
  slippageRate: number,
  participationRate: number
): BacktestResult {
  return {
    runId,
    name: config.name,
    startDate: config.startDate,
    endDate: config.endDate,
    params: config.strategyParams,
    costParams: {
      slippageRate,
      participationRate,
      feeRules: 'DEFAULT_FEE_RULES'
    },
    totalReturn: 0,
    cagr: 0,
    mdd: 0,
    winRate: 0,
    profitFactor: 0,
    sharpeRatio: 0,
    totalTrades: 0,
    trades: [],
    equityCurve: []
  };
}
