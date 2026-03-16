package com.trading.app.data.local.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "portfolio_snapshots", indices = [Index(value = ["date"], unique = true)])
data class PortfolioSnapshotEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val date: String,
    @ColumnInfo(name = "total_value") val totalValue: Double,
    val cash: Double,
    @ColumnInfo(name = "stock_value") val stockValue: Double,
    @ColumnInfo(name = "daily_pnl") val dailyPnl: Double = 0.0,
    @ColumnInfo(name = "daily_pnl_rate") val dailyPnlRate: Double = 0.0,
    @ColumnInfo(name = "cumulative_pnl_rate") val cumulativePnlRate: Double = 0.0,
    @ColumnInfo(name = "created_at") val createdAt: String,
)
