package com.trading.app.domain.model

data class StrategySpec(
    val id: String,
    val entryPeriod: Int,
    val exitPeriod: Int,
    val maxHoldDays: Int,
    /** 프리필터: 전일종가/DC상단 >= threshold 인 종목만 후보 */
    val proximityThreshold: Double,
) {
    companion object {
        /** Donchian 40/20 돌파 전략 (고가매수 백테스트 최적) */
        val DONCHIAN = StrategySpec("A", 40, 20, 15, 0.97)
        fun active() = DONCHIAN
    }
}
