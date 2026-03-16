package com.trading.app.domain.strategy

import com.trading.app.domain.model.*
import kotlin.math.floor

/** 사전 계산된 Donchian 지표 세트 */
data class StrategyIndicatorSet(
    val donchianEntryUpper: Double?,
    val donchianExitLower: Double?,
)

/** 종목별 사전 계산된 지표 */
data class StockIndicators(
    val todayOpen: Double,
    val todayHigh: Double,
    val todayLow: Double,
    val prevHigh: Double,
    val prevLow: Double,
    val prevClose: Double? = null,
    val avgVolume20: Double? = null,
    val todayVolume: Double? = null,
    val strategyIndicators: Map<String, StrategyIndicatorSet> = emptyMap(),
)

data class BudgetState(
    var remainingCash: Double,
    var remainingSlots: Int,
    val reservedStockCodes: MutableSet<String>,
)

/**
 * SignalGenerator: Stateless 순수 함수 클래스
 * Donchian Channel 돌파 전략 (DC40 진입 / DC20 이탈)
 */
class SignalGenerator {

    /**
     * 매수 평가: Donchian 40일 상단 돌파
     * todayHigh > donchianEntryUpper (전일까지 40일 최고가)
     */
    fun evaluateBuy(
        spec: StrategySpec,
        stockCode: String,
        stockName: String,
        currentPrice: Double,
        indicators: StockIndicators,
        budget: BudgetState,
        riskParams: RiskParams,
        totalEquity: Double,
        timestamp: String,
    ): Signal? {
        if (budget.remainingSlots <= 0) return null
        if (budget.reservedStockCodes.contains(stockCode)) return null

        val si = indicators.strategyIndicators[spec.id] ?: return null

        // Donchian 돌파: todayHigh > donchianEntryUpper (shifted, 전일까지)
        val entryUpper = si.donchianEntryUpper ?: return null
        if (indicators.todayHigh <= entryUpper) return null

        // 수량 계산
        val maxByWeight = totalEquity * riskParams.maxPositionWeight
        val maxAllocation = minOf(maxByWeight, riskParams.maxPositionAmount)
        val allocation = minOf(maxAllocation, budget.remainingCash)
        val quantity = floor(allocation / currentPrice).toInt()
        if (quantity <= 0) return null

        return Signal(
            stockCode = stockCode,
            stockName = stockName,
            side = OrderSide.BUY,
            reason = "donchian_breakout",
            confidence = 1.0,
            price = 0.0, // 시장가 주문
            quantity = quantity,
            strategyId = spec.id,
            timestamp = timestamp,
        )
    }

    /**
     * 매도 평가:
     * 1. Donchian 하한 이탈: currentPrice < donchianExitLower (20일 최저가)
     * 2. 최대 보유일: holdingDays >= maxHoldDays (15일)
     */
    fun evaluateSell(
        spec: StrategySpec,
        stockCode: String,
        stockName: String,
        currentPrice: Double,
        quantity: Int,
        holdingDays: Int,
        indicators: StockIndicators,
        timestamp: String,
    ): Signal? {
        val si = indicators.strategyIndicators[spec.id]

        // 1. Donchian 하한 이탈
        if (si != null) {
            val exitLower = si.donchianExitLower
            if (exitLower != null && currentPrice < exitLower) {
                return makeSellSignal(spec, stockCode, stockName, currentPrice, quantity, "donchian_exit", timestamp)
            }
        }

        // 2. 최대 보유일
        if (holdingDays >= spec.maxHoldDays) {
            return makeSellSignal(spec, stockCode, stockName, currentPrice, quantity, "hold_exit", timestamp)
        }

        return null
    }

    private fun makeSellSignal(
        spec: StrategySpec,
        stockCode: String,
        stockName: String,
        price: Double,
        quantity: Int,
        reason: String,
        timestamp: String,
    ): Signal {
        return Signal(
            stockCode = stockCode,
            stockName = stockName,
            side = OrderSide.SELL,
            reason = reason,
            confidence = 1.0,
            price = 0.0, // 시장가 주문
            quantity = quantity,
            strategyId = spec.id,
            timestamp = timestamp,
        )
    }
}
