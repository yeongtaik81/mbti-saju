package com.trading.app.data.local.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "stocks")
data class StockEntity(
    @PrimaryKey @ColumnInfo(name = "stock_code") val stockCode: String,
    @ColumnInfo(name = "stock_name") val stockName: String,
    val market: String = "",
)
