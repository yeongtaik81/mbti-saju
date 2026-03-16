package com.trading.app.domain.model

data class Signal(
    val stockCode: String,
    val stockName: String,
    val side: OrderSide,
    val reason: String,
    val confidence: Double,
    val price: Double,
    val quantity: Int,
    val strategyId: String,
    val timestamp: String,
)
