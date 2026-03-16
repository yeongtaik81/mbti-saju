package com.trading.app.domain.model

enum class RiskEventType {
    DAILY_LOSS_LIMIT,
    POSITION_LIMIT,
    WEIGHT_LIMIT,
    ORDER_REJECTED,
    CAPITAL_LIMIT;
}

enum class RiskAction {
    APPROVED,
    REJECTED,
    PAUSE_ENGINE,
    BLOCK_ORDER;
}

data class RiskDecision(
    val approved: Boolean,
    val action: RiskAction,
    val reason: String,
    val eventType: RiskEventType? = null,
)
