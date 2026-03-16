package com.trading.app.domain.model

data class RiskParams(
    val maxPositions: Int = 10,
    val maxPositionWeight: Double = 0.20,
    val maxPositionAmount: Double = 1_000_000.0,
    val dailyLossLimit: Double = -0.03,
    val totalCapital: Double = 10_000_000.0,
    /** 거래량 비율 상한 (todayVolume/avgVolume20 > cap 이면 매수 차단) */
    val volumeRatioCap: Double = 3.0,
)
