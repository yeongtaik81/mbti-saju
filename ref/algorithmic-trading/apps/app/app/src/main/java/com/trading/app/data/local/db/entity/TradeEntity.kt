package com.trading.app.data.local.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "trades",
    indices = [Index("stock_code"), Index("sold_at")]
)
data class TradeEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "stock_code") val stockCode: String,
    @ColumnInfo(name = "stock_name") val stockName: String,
    @ColumnInfo(name = "buy_order_id") val buyOrderId: String,
    @ColumnInfo(name = "sell_order_id") val sellOrderId: String,
    val quantity: Int,
    @ColumnInfo(name = "buy_price") val buyPrice: Double,
    @ColumnInfo(name = "sell_price") val sellPrice: Double,
    val pnl: Double,
    @ColumnInfo(name = "pnl_rate") val pnlRate: Double,
    @ColumnInfo(name = "fee_total") val feeTotal: Double = 0.0,
    val strategy: String,
    val signal: String,
    @ColumnInfo(name = "bought_at") val boughtAt: String,
    @ColumnInfo(name = "sold_at") val soldAt: String,
    val environment: String = "virtual",
)
