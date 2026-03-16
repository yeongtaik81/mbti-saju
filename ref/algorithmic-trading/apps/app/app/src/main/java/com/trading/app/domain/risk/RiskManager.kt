package com.trading.app.domain.risk

import com.trading.app.domain.model.*

class RiskManager {

    /**
     * 매수 주문 전 리스크 체크
     * 1. 포지션 수 제한
     * 2. 종목 비중 제한
     * 3. 일일 손실 한도
     */
    fun checkBuyOrder(
        signal: Signal,
        riskParams: RiskParams,
        portfolio: PortfolioContext,
        dailyPnlRate: Double = 0.0,
    ): RiskDecision {
        // 1. 포지션 수 제한
        if (portfolio.currentPositionCount >= riskParams.maxPositions) {
            return RiskDecision(
                approved = false,
                action = RiskAction.BLOCK_ORDER,
                reason = "Position limit reached: ${portfolio.currentPositionCount}/${riskParams.maxPositions}",
                eventType = RiskEventType.POSITION_LIMIT,
            )
        }

        // 2. 종목 비중 제한
        val orderAmount = signal.price * signal.quantity
        val weight = orderAmount / portfolio.totalEquity
        if (weight > riskParams.maxPositionWeight) {
            return RiskDecision(
                approved = false,
                action = RiskAction.BLOCK_ORDER,
                reason = "Weight limit exceeded: ${String.format("%.1f", weight * 100)}% > ${String.format("%.1f", riskParams.maxPositionWeight * 100)}%",
                eventType = RiskEventType.WEIGHT_LIMIT,
            )
        }

        // 3. 종목당 최대 금액 제한
        if (orderAmount > riskParams.maxPositionAmount) {
            return RiskDecision(
                approved = false,
                action = RiskAction.BLOCK_ORDER,
                reason = "Amount limit exceeded: ${String.format("%,.0f", orderAmount)}원 > ${String.format("%,.0f", riskParams.maxPositionAmount)}원",
                eventType = RiskEventType.WEIGHT_LIMIT,
            )
        }

        // 4. 자금 부족
        if (orderAmount > portfolio.cash) {
            return RiskDecision(
                approved = false,
                action = RiskAction.BLOCK_ORDER,
                reason = "Insufficient cash: need ${orderAmount.toLong()} but have ${portfolio.cash.toLong()}",
                eventType = RiskEventType.CAPITAL_LIMIT,
            )
        }

        // 5. 일일 손실 한도
        if (dailyPnlRate <= riskParams.dailyLossLimit) {
            return RiskDecision(
                approved = false,
                action = RiskAction.PAUSE_ENGINE,
                reason = "Daily loss limit hit: ${String.format("%.2f", dailyPnlRate * 100)}%",
                eventType = RiskEventType.DAILY_LOSS_LIMIT,
            )
        }

        return RiskDecision(
            approved = true,
            action = RiskAction.APPROVED,
            reason = "OK",
        )
    }

    fun checkSellOrder(signal: Signal): RiskDecision {
        // 매도는 항상 허용 (리스크 관리를 위한 매도는 차단하면 안 됨)
        return RiskDecision(
            approved = true,
            action = RiskAction.APPROVED,
            reason = "Sell always approved",
        )
    }
}
