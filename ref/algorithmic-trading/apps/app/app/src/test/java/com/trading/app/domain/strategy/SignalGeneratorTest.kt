package com.trading.app.domain.strategy

import com.trading.app.domain.model.*
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class SignalGeneratorTest {

    private lateinit var sg: SignalGenerator
    private val spec = StrategySpec.active() // DC40/20, maxHold=15
    private val defaultRisk = RiskParams()
    private val timestamp = "2026-03-13T10:00:00"

    private fun indicators(
        todayHigh: Double = 52000.0,
        todayLow: Double = 48000.0,
        dcEntryUpper: Double? = 51000.0,
        dcExitLower: Double? = 47000.0,
    ) = StockIndicators(
        todayOpen = 50000.0,
        todayHigh = todayHigh,
        todayLow = todayLow,
        prevHigh = 51500.0,
        prevLow = 48500.0,
        prevClose = 50100.0,
        avgVolume20 = 100000.0,
        todayVolume = 150000.0,
        strategyIndicators = mapOf(
            spec.id to StrategyIndicatorSet(
                donchianEntryUpper = dcEntryUpper,
                donchianExitLower = dcExitLower,
            )
        ),
    )

    private fun budget(cash: Double = 10_000_000.0, slots: Int = 5) = BudgetState(
        remainingCash = cash,
        remainingSlots = slots,
        reservedStockCodes = mutableSetOf(),
    )

    @Before
    fun setup() {
        sg = SignalGenerator()
    }

    // === Buy: Donchian Breakout ===

    @Test
    fun `buy - DC40 breakout triggers signal`() {
        // todayHigh=52000 > dcEntryUpper=51000 → 돌파
        val signal = sg.evaluateBuy(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 51500.0,
            indicators = indicators(todayHigh = 52000.0, dcEntryUpper = 51000.0),
            budget = budget(),
            riskParams = defaultRisk,
            totalEquity = 10_000_000.0,
            timestamp = timestamp,
        )
        assertNotNull(signal)
        assertEquals("donchian_breakout", signal!!.reason)
        assertEquals(OrderSide.BUY, signal.side)
    }

    @Test
    fun `buy - high below DC upper returns null`() {
        // todayHigh=50500 <= dcEntryUpper=51000 → 미돌파
        val signal = sg.evaluateBuy(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 50200.0,
            indicators = indicators(todayHigh = 50500.0, dcEntryUpper = 51000.0),
            budget = budget(),
            riskParams = defaultRisk,
            totalEquity = 10_000_000.0,
            timestamp = timestamp,
        )
        assertNull(signal)
    }

    @Test
    fun `buy - null DC upper returns null`() {
        val signal = sg.evaluateBuy(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 52000.0,
            indicators = indicators(dcEntryUpper = null),
            budget = budget(),
            riskParams = defaultRisk,
            totalEquity = 10_000_000.0,
            timestamp = timestamp,
        )
        assertNull(signal)
    }

    // === Buy: Budget Constraints ===

    @Test
    fun `buy - no slots returns null`() {
        val signal = sg.evaluateBuy(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 51500.0,
            indicators = indicators(),
            budget = budget(slots = 0),
            riskParams = defaultRisk,
            totalEquity = 10_000_000.0,
            timestamp = timestamp,
        )
        assertNull(signal)
    }

    @Test
    fun `buy - reserved stock returns null`() {
        val b = budget()
        b.reservedStockCodes.add("005930")
        val signal = sg.evaluateBuy(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 51500.0,
            indicators = indicators(),
            budget = b,
            riskParams = defaultRisk,
            totalEquity = 10_000_000.0,
            timestamp = timestamp,
        )
        assertNull(signal)
    }

    @Test
    fun `buy - insufficient cash returns null`() {
        val signal = sg.evaluateBuy(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 51500.0,
            indicators = indicators(),
            budget = budget(cash = 100.0), // 현금 부족
            riskParams = defaultRisk,
            totalEquity = 10_000_000.0,
            timestamp = timestamp,
        )
        assertNull(signal)
    }

    // === Sell: DC Exit ===

    @Test
    fun `sell - DC20 lower break triggers signal`() {
        // currentPrice=46500 < dcExitLower=47000 → 이탈
        val signal = sg.evaluateSell(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 46500.0,
            quantity = 10,
            holdingDays = 3,
            indicators = indicators(dcExitLower = 47000.0),
            timestamp = timestamp,
        )
        assertNotNull(signal)
        assertEquals("donchian_exit", signal!!.reason)
        assertEquals(OrderSide.SELL, signal.side)
    }

    @Test
    fun `sell - price above DC lower no signal`() {
        // currentPrice=48000 > dcExitLower=47000 → 이탈 아님
        val signal = sg.evaluateSell(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 48000.0,
            quantity = 10,
            holdingDays = 3,
            indicators = indicators(dcExitLower = 47000.0),
            timestamp = timestamp,
        )
        assertNull(signal)
    }

    // === Sell: Max Hold ===

    @Test
    fun `sell - max hold days triggers signal`() {
        val signal = sg.evaluateSell(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 52000.0,
            quantity = 10,
            holdingDays = 15, // == maxHoldDays
            indicators = indicators(),
            timestamp = timestamp,
        )
        assertNotNull(signal)
        assertEquals("hold_exit", signal!!.reason)
    }

    @Test
    fun `sell - before max hold no signal`() {
        val signal = sg.evaluateSell(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 52000.0,
            quantity = 10,
            holdingDays = 14, // < maxHoldDays
            indicators = indicators(),
            timestamp = timestamp,
        )
        assertNull(signal)
    }

    // === Sell: DC exit takes priority over hold exit ===

    @Test
    fun `sell - DC exit fires before hold exit`() {
        val signal = sg.evaluateSell(
            spec = spec,
            stockCode = "005930",
            stockName = "삼성전자",
            currentPrice = 46500.0, // < dcExitLower
            quantity = 10,
            holdingDays = 20, // also exceeds maxHold
            indicators = indicators(dcExitLower = 47000.0),
            timestamp = timestamp,
        )
        assertNotNull(signal)
        assertEquals("donchian_exit", signal!!.reason) // DC exit has priority
    }
}
