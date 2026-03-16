package com.trading.app.domain.market

import java.time.LocalTime

object MarketHours {
    const val PRE_MARKET_START = "08:00"
    const val TRADING_START = "09:00"
    const val CLOSING_START = "15:15"
    const val NEW_ORDER_CUTOFF = "15:20"
    const val MARKET_CLOSE = "15:30"
    const val POST_MARKET_END = "15:40"

    const val PRICE_LIMIT_RATE = 0.3 // ±30%

    private val preMarketStartTime = LocalTime.parse(PRE_MARKET_START)
    private val tradingStartTime = LocalTime.parse(TRADING_START)
    private val newOrderCutoffTime = LocalTime.parse(NEW_ORDER_CUTOFF)
    private val marketCloseTime = LocalTime.parse(MARKET_CLOSE)
    private val postMarketEndTime = LocalTime.parse(POST_MARKET_END)

    fun isMarketOpen(time: String): Boolean {
        val t = LocalTime.parse(time)
        return !t.isBefore(tradingStartTime) && t.isBefore(newOrderCutoffTime)
    }

    fun isMarketOpen(time: LocalTime): Boolean =
        !time.isBefore(tradingStartTime) && time.isBefore(newOrderCutoffTime)

    fun isPreMarket(time: String): Boolean {
        val t = LocalTime.parse(time)
        return !t.isBefore(preMarketStartTime) && t.isBefore(tradingStartTime)
    }

    fun isPostMarket(time: String): Boolean {
        val t = LocalTime.parse(time)
        return !t.isBefore(marketCloseTime) && t.isBefore(postMarketEndTime)
    }
}
