package com.trading.app.data.local.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "daily_candles",
    primaryKeys = ["stock_code", "date"],
    indices = [Index("date"), Index("date", "close")]
)
data class DailyCandleEntity(
    @ColumnInfo(name = "stock_code") val stockCode: String,
    val date: String,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double,
    @ColumnInfo(name = "adj_close") val adjClose: Double? = null,
    val volume: Long = 0,
    val amount: Double = 0.0,
)
