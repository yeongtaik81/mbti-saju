package com.trading.app.domain.order

import kotlin.math.ceil
import kotlin.math.floor

object TickSizeUtil {

    private data class TickRow(val maxPrice: Double, val tickSize: Int)

    private val TICK_SIZE_TABLE = listOf(
        TickRow(2_000.0, 1),
        TickRow(5_000.0, 5),
        TickRow(20_000.0, 10),
        TickRow(50_000.0, 50),
        TickRow(200_000.0, 100),
        TickRow(500_000.0, 500),
        TickRow(Double.MAX_VALUE, 1_000),
    )

    fun getTickSize(price: Double): Int {
        require(price > 0) { "Price must be positive" }
        for (row in TICK_SIZE_TABLE) {
            if (price <= row.maxPrice) return row.tickSize
        }
        return 1_000
    }

    /** 매수 호가 보정 (내림) */
    fun adjustBuyPrice(price: Double): Int {
        val tick = getTickSize(price)
        return (floor(price / tick) * tick).toInt()
    }

    /** 매도 호가 보정 (올림) */
    fun adjustSellPrice(price: Double): Int {
        val tick = getTickSize(price)
        return (ceil(price / tick) * tick).toInt()
    }
}
