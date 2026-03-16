package com.trading.app.data.local.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "positions",
    indices = [Index(value = ["stock_code", "strategy_id", "environment"], unique = true)],
)
data class PositionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "stock_code") val stockCode: String,
    @ColumnInfo(name = "stock_name") val stockName: String,
    val quantity: Int,
    @ColumnInfo(name = "avg_price") val avgPrice: Double,
    @ColumnInfo(name = "current_price") val currentPrice: Double = 0.0,
    val pnl: Double = 0.0,
    @ColumnInfo(name = "pnl_rate") val pnlRate: Double = 0.0,
    @ColumnInfo(name = "bought_at") val boughtAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
    @ColumnInfo(name = "strategy_id") val strategyId: String = "A",
    val environment: String = "virtual",
    val source: String = "engine", // "engine" = 앱 매수, "balance_sync" = KIS 잔고 동기화
)
