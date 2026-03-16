import type {
  Signal,
  StrategyParams,
  OrderSide,
  MarketRegime
} from '@trading/shared/types';

/** 종목별 사전 계산된 지표 */
export interface StockIndicators {
  todayOpen: number;
  prevHigh: number;
  prevLow: number;
  shortMa: number | null;
  longMa: number | null;
  currentRsi: number | null;
  // 스윙 전략 전용
  prevClose?: number;
  avgVolume20?: number;
  todayVolume?: number;
}

/** 포트폴리오 현황 [SF-6] */
export interface PortfolioContext {
  cash: number;
  totalEquity: number;
  currentPositionCount: number;
}

/**
 * SignalGenerator: Stateless 순수 함수 클래스
 * backtest.ts의 매매 로직을 실시간용으로 추출
 *
 * 설계: 일봉 기반 지표를 PRE_MARKET에서 1회 계산,
 * 장중에는 실시간 가격만 비교하여 신호 생성
 */
export class SignalGenerator {
  /**
   * 매수 신호 평가
   * intraday: 변동성 돌파 + MA 골든크로스 + RSI 필터
   * swing: 레짐 기반 (BULL=MA지지, BEAR=변동성돌파)
   */
  evaluateBuy(params: {
    stockCode: string;
    stockName: string;
    currentPrice: number;
    indicators: StockIndicators;
    strategyParams: StrategyParams;
    riskParams: {
      maxPositions: number;
      maxPositionWeight: number;
      totalCapital: number;
    };
    portfolio: PortfolioContext;
    timestamp: string;
    regime?: MarketRegime;
  }): Signal | null {
    if (params.strategyParams.strategyMode === 'swing') {
      return this.evaluateBuySwing(params);
    }
    return this.evaluateBuyIntraday(params);
  }

  /**
   * 매도 신호 평가
   * intraday: 손절 → 익절 → RSI → 데드크로스 → 시간청산
   * swing: 손절 → 보유일 초과
   */
  evaluateSell(params: {
    stockCode: string;
    stockName: string;
    currentPrice: number;
    buyPrice: number;
    quantity: number;
    indicators: StockIndicators;
    strategyParams: StrategyParams;
    currentTime: string;
    timestamp: string;
    holdingTradingDays?: number;
  }): Signal | null {
    if (params.strategyParams.strategyMode === 'swing') {
      return this.evaluateSellSwing(params);
    }
    return this.evaluateSellIntraday(params);
  }

  // === Intraday (기존 로직) ===

  private evaluateBuyIntraday(params: {
    stockCode: string;
    stockName: string;
    currentPrice: number;
    indicators: StockIndicators;
    strategyParams: StrategyParams;
    riskParams: {
      maxPositions: number;
      maxPositionWeight: number;
      totalCapital: number;
    };
    portfolio: PortfolioContext;
    timestamp: string;
  }): Signal | null {
    const {
      stockCode,
      stockName,
      currentPrice,
      indicators,
      strategyParams,
      riskParams,
      portfolio
    } = params;
    const { k } = strategyParams;

    if (portfolio.currentPositionCount >= riskParams.maxPositions) return null;

    const range = indicators.prevHigh - indicators.prevLow;
    const breakoutTarget = indicators.todayOpen + k * range;
    const breakoutMet = currentPrice > breakoutTarget && range > 0;

    const maCrossMet =
      indicators.shortMa !== null &&
      indicators.longMa !== null &&
      indicators.shortMa > indicators.longMa;

    const rsiMet =
      indicators.currentRsi === null ||
      indicators.currentRsi <= strategyParams.rsiHigh;

    if (!breakoutMet) return null;

    const conditions = [breakoutMet, maCrossMet, rsiMet];
    const metCount = conditions.filter(Boolean).length;
    const confidence = metCount / conditions.length;

    if (metCount < 2) return null;

    const maxAllocation = portfolio.totalEquity * riskParams.maxPositionWeight;
    const allocation = Math.min(maxAllocation, portfolio.cash);
    const quantity = Math.floor(allocation / currentPrice);
    if (quantity <= 0) return null;

    const reasons: string[] = ['volatility_breakout'];
    if (maCrossMet) reasons.push('ma_cross');
    if (rsiMet && indicators.currentRsi !== null) reasons.push('rsi');

    return {
      stockCode,
      stockName,
      side: 'buy' as OrderSide,
      reason: reasons.join('+'),
      confidence,
      price: currentPrice,
      quantity,
      paramsSnapshot: strategyParams,
      timestamp: params.timestamp
    };
  }

  private evaluateSellIntraday(params: {
    stockCode: string;
    stockName: string;
    currentPrice: number;
    buyPrice: number;
    quantity: number;
    indicators: StockIndicators;
    strategyParams: StrategyParams;
    currentTime: string;
    timestamp: string;
  }): Signal | null {
    const { currentPrice, buyPrice, indicators, strategyParams, currentTime } =
      params;
    const pnlRate = (currentPrice - buyPrice) / buyPrice;

    if (pnlRate <= strategyParams.stopLossRate) {
      return this.makeSellSignal(params, 'stop_loss');
    }
    if (pnlRate >= strategyParams.takeProfitRate) {
      return this.makeSellSignal(params, 'take_profit');
    }
    if (
      indicators.currentRsi !== null &&
      indicators.currentRsi >= strategyParams.rsiHigh
    ) {
      return this.makeSellSignal(params, 'rsi_overbought');
    }
    if (
      indicators.shortMa !== null &&
      indicators.longMa !== null &&
      indicators.shortMa < indicators.longMa
    ) {
      return this.makeSellSignal(params, 'ma_dead_cross');
    }
    if (currentTime >= strategyParams.closingTime) {
      return this.makeSellSignal(params, 'time_exit');
    }
    return null;
  }

  // === Swing (신규) ===

  /**
   * 스윙 매수: 레짐 기반
   * BULL: MA 지지 (prevClose가 longMA의 ±proximity% 이내)
   * BEAR: 변동성 돌파 (K × range) + RSI 필터
   * NEUTRAL: 매수 안 함
   *
   * 공통: 10MA > 60MA + VR ≥ threshold
   */
  private evaluateBuySwing(params: {
    stockCode: string;
    stockName: string;
    currentPrice: number;
    indicators: StockIndicators;
    strategyParams: StrategyParams;
    riskParams: {
      maxPositions: number;
      maxPositionWeight: number;
      totalCapital: number;
    };
    portfolio: PortfolioContext;
    timestamp: string;
    regime?: MarketRegime;
  }): Signal | null {
    const {
      stockCode,
      stockName,
      currentPrice,
      indicators,
      strategyParams,
      riskParams,
      portfolio,
      regime
    } = params;

    if (!regime || regime === 'NEUTRAL') return null;
    if (portfolio.currentPositionCount >= riskParams.maxPositions) return null;

    // 공통 조건 1: MA 골든크로스 (shortMA > longMA)
    if (indicators.shortMa === null || indicators.longMa === null) return null;
    if (indicators.shortMa <= indicators.longMa) return null;

    // 공통 조건 2: Volume Ratio ≥ threshold (데이터 부재 시 매수 차단)
    const vrThreshold = strategyParams.volumeRatioThreshold ?? 2.0;
    const avgVol = indicators.avgVolume20 ?? 0;
    const todayVol = indicators.todayVolume ?? 0;
    if (avgVol <= 0 || todayVol <= 0) return null;
    if (todayVol / avgVol < vrThreshold) return null;

    let reason: string;

    if (regime === 'BULL') {
      // MA 지지: prevClose가 longMA의 proximity% 이내
      const proximity = strategyParams.maSupportProximity ?? 0.02;
      const prevClose = indicators.prevClose ?? 0;
      if (prevClose <= 0 || indicators.longMa <= 0) return null;

      const ratio = prevClose / indicators.longMa;
      if (ratio > 1 + proximity || ratio < 1 - proximity) return null;

      reason = 'ma_support';
    } else {
      // BEAR: 변동성 돌파
      const range = indicators.prevHigh - indicators.prevLow;
      if (range <= 0) return null;

      const breakoutTarget = indicators.todayOpen + strategyParams.k * range;
      if (currentPrice <= breakoutTarget) return null;

      // RSI 필터
      if (indicators.currentRsi !== null) {
        if (
          indicators.currentRsi < strategyParams.rsiLow ||
          indicators.currentRsi > strategyParams.rsiHigh
        ) {
          return null;
        }
      }

      reason = 'volatility_breakout';
    }

    // 수량 계산
    const maxAllocation = portfolio.totalEquity * riskParams.maxPositionWeight;
    const allocation = Math.min(maxAllocation, portfolio.cash);
    const quantity = Math.floor(allocation / currentPrice);
    if (quantity <= 0) return null;

    return {
      stockCode,
      stockName,
      side: 'buy' as OrderSide,
      reason,
      confidence: 1.0,
      price: currentPrice,
      quantity,
      paramsSnapshot: strategyParams,
      timestamp: params.timestamp
    };
  }

  /**
   * 스윙 매도: 손절 또는 보유일 초과만
   * 1. SL: pnlRate ≤ stopLossRate (-7%)
   * 2. 보유일: holdingTradingDays >= holdDays (7)
   */
  private evaluateSellSwing(params: {
    stockCode: string;
    stockName: string;
    currentPrice: number;
    buyPrice: number;
    quantity: number;
    strategyParams: StrategyParams;
    timestamp: string;
    holdingTradingDays?: number;
  }): Signal | null {
    const { currentPrice, buyPrice, strategyParams, holdingTradingDays } =
      params;
    const pnlRate = (currentPrice - buyPrice) / buyPrice;

    // 1. 손절
    if (pnlRate <= strategyParams.stopLossRate) {
      return this.makeSellSignal(params, 'stop_loss');
    }

    // 2. 보유일 초과
    const holdDays = strategyParams.holdDays ?? 7;
    if (holdingTradingDays !== undefined && holdingTradingDays >= holdDays) {
      return this.makeSellSignal(params, 'hold_exit');
    }

    return null;
  }

  private makeSellSignal(
    params: {
      stockCode: string;
      stockName: string;
      currentPrice: number;
      quantity: number;
      strategyParams: StrategyParams;
      timestamp: string;
    },
    reason: string
  ): Signal {
    return {
      stockCode: params.stockCode,
      stockName: params.stockName,
      side: 'sell' as OrderSide,
      reason,
      confidence: 1.0,
      price: params.currentPrice,
      quantity: params.quantity,
      paramsSnapshot: params.strategyParams,
      timestamp: params.timestamp
    };
  }
}
