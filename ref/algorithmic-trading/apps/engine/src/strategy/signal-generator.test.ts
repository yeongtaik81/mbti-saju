import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SignalGenerator } from './signal-generator.js';
import type { StockIndicators, PortfolioContext } from './signal-generator.js';
import type { StrategyParams } from '@trading/shared/types';

const defaultStrategy: StrategyParams = {
  k: 0.5,
  shortMaPeriod: 5,
  longMaPeriod: 20,
  rsiPeriod: 14,
  rsiLow: 30,
  rsiHigh: 70,
  stopLossRate: -0.03,
  takeProfitRate: 0.05,
  closingTime: '15:15'
};

const defaultRisk = {
  maxPositions: 5,
  maxPositionWeight: 0.2,
  totalCapital: 10_000_000
};

const defaultPortfolio: PortfolioContext = {
  cash: 10_000_000,
  totalEquity: 10_000_000,
  currentPositionCount: 0
};

function makeIndicators(
  overrides: Partial<StockIndicators> = {}
): StockIndicators {
  return {
    todayOpen: 70000,
    prevHigh: 72000,
    prevLow: 68000,
    shortMa: 71000,
    longMa: 70000,
    currentRsi: 50,
    ...overrides
  };
}

const generator = new SignalGenerator();

describe('SignalGenerator - 매수', () => {
  it('변동성 돌파 + MA 크로스 + RSI 모두 충족 시 매수 신호를 생성한다', () => {
    // breakout target = 70000 + 0.5 * (72000 - 68000) = 72000
    // currentPrice 73000 > 72000 → 충족
    // shortMa 71000 > longMa 70000 → 충족
    // RSI 50 <= 70 → 충족
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      indicators: makeIndicators(),
      strategyParams: defaultStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00'
    });

    assert.ok(signal);
    assert.equal(signal.side, 'buy');
    assert.equal(signal.stockCode, '005930');
    assert.equal(signal.confidence, 1.0);
    assert.ok(signal.reason.includes('volatility_breakout'));
    assert.ok(signal.reason.includes('ma_cross'));
    assert.ok(signal.quantity > 0);
  });

  it('변동성 돌파 미충족 시 null을 반환한다', () => {
    // currentPrice 71000 < breakout target 72000 → 미충족
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 71000,
      indicators: makeIndicators(),
      strategyParams: defaultStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00'
    });

    assert.equal(signal, null);
  });

  it('변동성 돌파만 충족하고 다른 조건 미충족 시 null을 반환한다 (최소 2개 필요)', () => {
    // breakout 충족, MA 데드크로스, RSI 과매수
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      indicators: makeIndicators({
        shortMa: 69000,
        longMa: 71000,
        currentRsi: 80
      }),
      strategyParams: defaultStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00'
    });

    assert.equal(signal, null);
  });

  it('포지션 한도 도달 시 null을 반환한다', () => {
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      indicators: makeIndicators(),
      strategyParams: defaultStrategy,
      riskParams: defaultRisk,
      portfolio: { ...defaultPortfolio, currentPositionCount: 5 },
      timestamp: '2026-03-05T10:00:00'
    });

    assert.equal(signal, null);
  });

  it('현금 부족 시 null을 반환한다', () => {
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      indicators: makeIndicators(),
      strategyParams: defaultStrategy,
      riskParams: defaultRisk,
      portfolio: { ...defaultPortfolio, cash: 100 }, // 1주도 못 삼
      timestamp: '2026-03-05T10:00:00'
    });

    assert.equal(signal, null);
  });

  it('수량은 종목당 최대 비중 기반으로 계산된다', () => {
    // maxPositionWeight 0.2 × totalEquity 10M = 2M allocation
    // 2M / 73000 = 27.xxx → 27주
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      indicators: makeIndicators(),
      strategyParams: defaultStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00'
    });

    assert.ok(signal);
    assert.equal(signal.quantity, 27);
  });

  it('MA가 null이면 MA 조건을 미충족으로 처리한다', () => {
    // breakout 충족, MA null, RSI 충족 → 2개 조건 (breakout + rsi)
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      indicators: makeIndicators({ shortMa: null, longMa: null }),
      strategyParams: defaultStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00'
    });

    assert.ok(signal);
    assert.equal(signal.confidence, 2 / 3);
  });

  it('RSI가 null이면 RSI 조건을 충족으로 처리한다', () => {
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      indicators: makeIndicators({ currentRsi: null }),
      strategyParams: defaultStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00'
    });

    assert.ok(signal);
  });

  it('전일 범위가 0이면 변동성 돌파 미충족', () => {
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      indicators: makeIndicators({ prevHigh: 70000, prevLow: 70000 }),
      strategyParams: defaultStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00'
    });

    assert.equal(signal, null);
  });
});

describe('SignalGenerator - 매도', () => {
  it('손절 조건 충족 시 매도 신호를 생성한다', () => {
    // pnlRate = (69000 - 72000) / 72000 = -0.0417 < -0.03
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 69000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeIndicators(),
      strategyParams: defaultStrategy,
      currentTime: '10:00',
      timestamp: '2026-03-05T10:00:00'
    });

    assert.ok(signal);
    assert.equal(signal.reason, 'stop_loss');
    assert.equal(signal.quantity, 10);
  });

  it('익절 조건 충족 시 매도 신호를 생성한다', () => {
    // pnlRate = (76000 - 72000) / 72000 = 0.0556 > 0.05
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 76000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeIndicators(),
      strategyParams: defaultStrategy,
      currentTime: '10:00',
      timestamp: '2026-03-05T10:00:00'
    });

    assert.ok(signal);
    assert.equal(signal.reason, 'take_profit');
  });

  it('RSI 과매수 시 매도 신호를 생성한다', () => {
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeIndicators({ currentRsi: 75 }),
      strategyParams: defaultStrategy,
      currentTime: '10:00',
      timestamp: '2026-03-05T10:00:00'
    });

    assert.ok(signal);
    assert.equal(signal.reason, 'rsi_overbought');
  });

  it('데드크로스 시 매도 신호를 생성한다', () => {
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeIndicators({
        shortMa: 69000,
        longMa: 71000,
        currentRsi: 50
      }),
      strategyParams: defaultStrategy,
      currentTime: '10:00',
      timestamp: '2026-03-05T10:00:00'
    });

    assert.ok(signal);
    assert.equal(signal.reason, 'ma_dead_cross');
  });

  it('시간청산 조건 충족 시 매도 신호를 생성한다', () => {
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeIndicators(),
      strategyParams: defaultStrategy,
      currentTime: '15:15',
      timestamp: '2026-03-05T15:15:00'
    });

    assert.ok(signal);
    assert.equal(signal.reason, 'time_exit');
  });

  it('매도 조건 우선순위: 손절 > 익절', () => {
    // 손절과 시간청산 모두 충족되면 손절이 우선
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 69000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeIndicators(),
      strategyParams: defaultStrategy,
      currentTime: '15:20',
      timestamp: '2026-03-05T15:20:00'
    });

    assert.ok(signal);
    assert.equal(signal.reason, 'stop_loss');
  });

  it('매도 조건 미충족 시 null을 반환한다', () => {
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeIndicators(),
      strategyParams: defaultStrategy,
      currentTime: '10:00',
      timestamp: '2026-03-05T10:00:00'
    });

    assert.equal(signal, null);
  });
});

// === Swing 전략 테스트 ===

const swingStrategy: StrategyParams = {
  k: 0.4,
  shortMaPeriod: 10,
  longMaPeriod: 60,
  rsiPeriod: 14,
  rsiLow: 20,
  rsiHigh: 80,
  stopLossRate: -0.07,
  takeProfitRate: 0.1,
  closingTime: '15:15',
  strategyMode: 'swing',
  holdDays: 7,
  breadthBullThreshold: 0.5,
  breadthBearThreshold: 0.4,
  maSupportProximity: 0.02,
  volumeRatioThreshold: 2.0
};

function makeSwingIndicators(
  overrides: Partial<StockIndicators> = {}
): StockIndicators {
  return {
    todayOpen: 70000,
    prevHigh: 72000,
    prevLow: 68000,
    shortMa: 71000,
    longMa: 70000,
    currentRsi: 50,
    prevClose: 70500,
    avgVolume20: 10000,
    todayVolume: 25000, // VR = 2.5
    ...overrides
  };
}

describe('SignalGenerator - Swing 매수', () => {
  it('BULL 레짐: MA 지지 조건 충족 시 매수', () => {
    // prevClose 70500, longMa 70000, ratio=1.007 → 2% 이내 → 충족
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 70500,
      indicators: makeSwingIndicators(),
      strategyParams: swingStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T09:00:00',
      regime: 'BULL'
    });

    assert.ok(signal);
    assert.equal(signal.reason, 'ma_support');
  });

  it('BULL 레짐: prevClose가 longMA에서 2% 초과 시 null', () => {
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      indicators: makeSwingIndicators({ prevClose: 73000 }), // 73000/70000=1.043 > 1.02
      strategyParams: swingStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T09:00:00',
      regime: 'BULL'
    });

    assert.equal(signal, null);
  });

  it('BEAR 레짐: 변동성 돌파 조건 충족 시 매수', () => {
    // breakout = 70000 + 0.4 * (72000-68000) = 71600
    // currentPrice 72000 > 71600 → 충족
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 72000,
      indicators: makeSwingIndicators(),
      strategyParams: swingStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00',
      regime: 'BEAR'
    });

    assert.ok(signal);
    assert.equal(signal.reason, 'volatility_breakout');
  });

  it('BEAR 레짐: 변동성 돌파 미충족 시 null', () => {
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 71000,
      indicators: makeSwingIndicators(),
      strategyParams: swingStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00',
      regime: 'BEAR'
    });

    assert.equal(signal, null);
  });

  it('BEAR 레짐: RSI 범위 밖이면 null', () => {
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 72000,
      indicators: makeSwingIndicators({ currentRsi: 85 }), // > 80
      strategyParams: swingStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00',
      regime: 'BEAR'
    });

    assert.equal(signal, null);
  });

  it('NEUTRAL 레짐: 항상 null', () => {
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 72000,
      indicators: makeSwingIndicators(),
      strategyParams: swingStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00',
      regime: 'NEUTRAL'
    });

    assert.equal(signal, null);
  });

  it('VR 미달 시 null', () => {
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 72000,
      indicators: makeSwingIndicators({ todayVolume: 15000 }), // VR = 1.5 < 2.0
      strategyParams: swingStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00',
      regime: 'BEAR'
    });

    assert.equal(signal, null);
  });

  it('MA 데드크로스 (shortMa <= longMa) 시 null', () => {
    const signal = generator.evaluateBuy({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 72000,
      indicators: makeSwingIndicators({ shortMa: 69000 }),
      strategyParams: swingStrategy,
      riskParams: defaultRisk,
      portfolio: defaultPortfolio,
      timestamp: '2026-03-05T10:00:00',
      regime: 'BEAR'
    });

    assert.equal(signal, null);
  });
});

describe('SignalGenerator - Swing 매도', () => {
  it('SL -7% 충족 시 stop_loss', () => {
    // pnlRate = (65000 - 72000) / 72000 = -0.0972 < -0.07
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 65000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeSwingIndicators(),
      strategyParams: swingStrategy,
      currentTime: '10:00',
      timestamp: '2026-03-05T10:00:00',
      holdingTradingDays: 3
    });

    assert.ok(signal);
    assert.equal(signal.reason, 'stop_loss');
  });

  it('7거래일 보유 후 hold_exit', () => {
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeSwingIndicators(),
      strategyParams: swingStrategy,
      currentTime: '09:00',
      timestamp: '2026-03-05T09:00:00',
      holdingTradingDays: 7
    });

    assert.ok(signal);
    assert.equal(signal.reason, 'hold_exit');
  });

  it('6거래일 보유 + SL 미달 시 null', () => {
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeSwingIndicators(),
      strategyParams: swingStrategy,
      currentTime: '10:00',
      timestamp: '2026-03-05T10:00:00',
      holdingTradingDays: 6
    });

    assert.equal(signal, null);
  });

  it('swing 모드에서 time_exit 발생하지 않음', () => {
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeSwingIndicators(),
      strategyParams: swingStrategy,
      currentTime: '15:20',
      timestamp: '2026-03-05T15:20:00',
      holdingTradingDays: 3
    });

    assert.equal(signal, null);
  });

  it('swing 모드에서 RSI 과매수로 매도하지 않음', () => {
    const signal = generator.evaluateSell({
      stockCode: '005930',
      stockName: '삼성전자',
      currentPrice: 73000,
      buyPrice: 72000,
      quantity: 10,
      indicators: makeSwingIndicators({ currentRsi: 90 }),
      strategyParams: swingStrategy,
      currentTime: '10:00',
      timestamp: '2026-03-05T10:00:00',
      holdingTradingDays: 3
    });

    assert.equal(signal, null);
  });
});
