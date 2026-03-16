package com.trading.app.domain.model

data class Candle(
    val stockCode: String,
    val date: String,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double,
    val adjClose: Double? = null,
    val volume: Long,
    val amount: Long? = null,
) {
    /** 수정주가 우선, 없으면 종가. adjClose가 0이면 무효 처리 */
    val effectiveClose: Double get() = adjClose?.takeIf { it > 0.0 } ?: close
}
