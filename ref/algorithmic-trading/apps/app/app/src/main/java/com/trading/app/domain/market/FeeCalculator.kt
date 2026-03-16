package com.trading.app.domain.market

import com.trading.app.domain.model.OrderSide

object FeeCalculator {

    private const val BROKER_RATE = 0.00015   // 매수/매도 모두 0.015%
    private const val TAX_RATE = 0.0018       // 증권거래세 0.18%
    private const val SPECIAL_TAX_RATE = 0.0015 // 농어촌특별세 0.15% (코스피만)

    data class FeeBreakdown(
        val brokerFee: Double,
        val tax: Double,
        val specialTax: Double,
        val total: Double,
    )

    fun calculate(side: OrderSide, amount: Double, market: String = "KOSPI"): FeeBreakdown {
        val brokerFee = amount * BROKER_RATE

        if (side == OrderSide.BUY) {
            return FeeBreakdown(brokerFee, 0.0, 0.0, brokerFee)
        }

        val tax = amount * TAX_RATE
        val specialTax = if (market == "KOSPI") amount * SPECIAL_TAX_RATE else 0.0
        return FeeBreakdown(brokerFee, tax, specialTax, brokerFee + tax + specialTax)
    }
}
