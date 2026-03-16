package com.trading.app.domain.model

data class Position(
    val id: Long = 0,
    val stockCode: String,
    val stockName: String,
    val quantity: Int,
    val avgPrice: Double,
    val currentPrice: Double,
    val pnl: Double,
    val pnlRate: Double,
    val boughtAt: String,
    val updatedAt: String,
    val strategyId: String = "A",
    val source: String = "engine",
)

data class PortfolioSnapshot(
    val id: Long = 0,
    val date: String,
    val totalValue: Double,
    val cash: Double,
    val stockValue: Double,
    val dailyPnl: Double,
    val dailyPnlRate: Double,
    val cumulativePnlRate: Double,
    val createdAt: String,
)

data class PortfolioContext(
    val cash: Double,
    val totalEquity: Double,
    val currentPositionCount: Int,
)
