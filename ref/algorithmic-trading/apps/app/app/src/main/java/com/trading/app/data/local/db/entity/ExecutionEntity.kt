package com.trading.app.data.local.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "executions",
    indices = [Index("order_id"), Index("executed_at")]
)
data class ExecutionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "order_id") val orderId: String,
    @ColumnInfo(name = "stock_code") val stockCode: String,
    val side: String,
    val quantity: Int,
    val price: Double,
    val amount: Double,
    val fee: Double = 0.0,
    val tax: Double = 0.0,
    @ColumnInfo(name = "executed_at") val executedAt: String,
)
