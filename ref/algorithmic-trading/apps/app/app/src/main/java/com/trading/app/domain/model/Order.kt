package com.trading.app.domain.model

enum class OrderStatus(val value: String) {
    CREATED("CREATED"),
    SUBMITTED("SUBMITTED"),
    PENDING("PENDING"),
    PARTIAL_FILLED("PARTIAL_FILLED"),
    FILLED("FILLED"),
    REJECTED("REJECTED"),
    CANCEL_REQUESTED("CANCEL_REQUESTED"),
    CANCELLED("CANCELLED"),
    ERROR("ERROR");

    companion object {
        fun fromValue(value: String): OrderStatus =
            entries.first { it.value == value }
    }
}

enum class OrderType(val value: String) {
    MARKET("MARKET"),
    LIMIT("LIMIT");
}

enum class OrderSide(val value: String) {
    BUY("buy"),
    SELL("sell");
}

data class OrderRequest(
    val orderId: String,
    val stockCode: String,
    val stockName: String,
    val side: OrderSide,
    val orderType: OrderType,
    val quantity: Int,
    val price: Double,
    val strategy: String,
    val signal: String,
)

data class Order(
    val id: Long = 0,
    val orderId: String,
    val kisOrderNo: String? = null,
    val stockCode: String,
    val stockName: String,
    val side: OrderSide,
    val orderType: OrderType,
    val quantity: Int,
    val price: Double,
    val status: OrderStatus,
    val filledQuantity: Int = 0,
    val filledPrice: Double = 0.0,
    val rejectReason: String? = null,
    val strategy: String,
    val signal: String,
    val createdAt: String,
    val updatedAt: String,
)
