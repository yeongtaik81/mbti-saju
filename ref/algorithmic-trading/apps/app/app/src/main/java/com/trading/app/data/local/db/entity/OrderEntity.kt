package com.trading.app.data.local.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "orders",
    indices = [
        Index("stock_code"),
        Index("status"),
        Index("created_at"),
        Index("stock_code", "side", "status"),
    ]
)
data class OrderEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "order_id") val orderId: String,
    @ColumnInfo(name = "kis_order_no") val kisOrderNo: String? = null,
    @ColumnInfo(name = "stock_code") val stockCode: String,
    @ColumnInfo(name = "stock_name") val stockName: String,
    val side: String,
    @ColumnInfo(name = "order_type") val orderType: String,
    val quantity: Int,
    val price: Double = 0.0,
    val status: String = "CREATED",
    @ColumnInfo(name = "filled_quantity") val filledQuantity: Int = 0,
    @ColumnInfo(name = "filled_price") val filledPrice: Double = 0.0,
    @ColumnInfo(name = "reject_reason") val rejectReason: String? = null,
    val strategy: String,
    val signal: String,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
    val environment: String = "virtual",
)
