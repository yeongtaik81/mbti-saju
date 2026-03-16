package com.trading.app.data.remote.kis

enum class KisEnv(val restBaseUrl: String) {
    VIRTUAL("https://openapivts.koreainvestment.com:29443"),
    PRODUCTION("https://openapi.koreainvestment.com:9443");

    companion object {
        fun fromString(env: String): KisEnv =
            if (env == "production") PRODUCTION else VIRTUAL
    }
}

object KisConfig {
    /** TR_ID mappings per environment — matches TypeScript engine config.ts */
    private val TR_ID_MAP = mapOf(
        KisEnv.PRODUCTION to mapOf(
            "cashBuy" to "TTTC0802U",
            "cashSell" to "TTTC0801U",
            "orderModify" to "TTTC0803U",
            "cancel" to "TTTC0803U",
            "balance" to "TTTC8434R",
            "currentPrice" to "FHKST01010100",
            "dailyCandle" to "FHKST03010100",
            "minuteCandle" to "FHKST03010200",
            "executions" to "TTTC8001R",
            "openOrders" to "TTTC8036R",
            "orderableCash" to "TTTC8908R",
        ),
        KisEnv.VIRTUAL to mapOf(
            "cashBuy" to "VTTC0802U",
            "cashSell" to "VTTC0801U",
            "orderModify" to "VTTC0803U",
            "cancel" to "VTTC0803U",
            "balance" to "VTTC8434R",
            "currentPrice" to "FHKST01010100",
            "dailyCandle" to "FHKST03010100",
            "minuteCandle" to "FHKST03010200",
            "executions" to "VTTC8001R",
            "openOrders" to "VTTC8036R",
            "orderableCash" to "VTTC8908R",
        ),
    )

    fun getTrId(env: KisEnv, operation: String): String =
        TR_ID_MAP[env]?.get(operation)
            ?: throw IllegalArgumentException("Unknown operation: $operation")

    /** API 호출 간 딜레이 (ms) — 모의투자: 5 req/s (200ms), 실전: 20 req/s (60ms) */
    fun getApiDelayMs(env: KisEnv): Long = when (env) {
        KisEnv.VIRTUAL -> 200L
        KisEnv.PRODUCTION -> 60L
    }

    /** 주문 간 딜레이 (ms) — 모의투자: 더 보수적으로 */
    fun getOrderDelayMs(env: KisEnv): Long = when (env) {
        KisEnv.VIRTUAL -> 400L
        KisEnv.PRODUCTION -> 150L
    }

    const val CONTENT_TYPE = "application/json; charset=utf-8"
    const val CUST_TYPE = "P"
}
