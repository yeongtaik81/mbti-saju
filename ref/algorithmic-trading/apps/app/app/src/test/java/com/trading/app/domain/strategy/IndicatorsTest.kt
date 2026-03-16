package com.trading.app.domain.strategy

import com.trading.app.domain.model.Candle
import org.junit.Assert.*
import org.junit.Test
import kotlin.math.abs

class IndicatorsTest {

    private fun candle(close: Double, high: Double = close, low: Double = close, volume: Long = 1000): Candle =
        Candle("005930", "2026-01-01", close, high, low, close, null, volume)

    @Test
    fun `sma returns nulls when period exceeds data length`() {
        val candles = listOf(candle(100.0), candle(200.0))
        val result = Indicators.sma(candles, 5)
        assertTrue(result.all { it == null })
    }

    @Test
    fun `sma calculates correct values`() {
        val candles = (1..5).map { candle(it.toDouble()) }
        val result = Indicators.sma(candles, 3)

        assertNull(result[0])
        assertNull(result[1])
        assertEquals(2.0, result[2]!!, 0.001) // (1+2+3)/3
        assertEquals(3.0, result[3]!!, 0.001) // (2+3+4)/3
        assertEquals(4.0, result[4]!!, 0.001) // (3+4+5)/3
    }

    @Test
    fun `sma uses adjClose when available`() {
        val candles = listOf(
            Candle("005930", "2026-01-01", 100.0, 100.0, 100.0, 100.0, 50.0, 1000),
            Candle("005930", "2026-01-02", 100.0, 100.0, 100.0, 100.0, 60.0, 1000),
        )
        val result = Indicators.sma(candles, 2)
        assertEquals(55.0, result[1]!!, 0.001)
    }

    @Test
    fun `rsi returns nulls when insufficient data`() {
        val candles = listOf(candle(100.0))
        val result = Indicators.rsi(candles, 14)
        assertTrue(result.all { it == null })
    }

    @Test
    fun `rsi returns 100 when all gains`() {
        val candles = (1..16).map { candle(it.toDouble()) }
        val result = Indicators.rsi(candles, 14)
        assertEquals(100.0, result[14]!!, 0.001)
    }

    @Test
    fun `rsi returns 0 when all losses`() {
        val candles = (16 downTo 1).map { candle(it.toDouble()) }
        val result = Indicators.rsi(candles, 14)
        assertEquals(0.0, result[14]!!, 0.001)
    }

    @Test
    fun `atr calculates true range correctly`() {
        val candles = listOf(
            candle(100.0, high = 105.0, low = 95.0),
            candle(103.0, high = 108.0, low = 98.0),
            candle(106.0, high = 111.0, low = 101.0),
        )
        val result = Indicators.atr(candles, 2)

        assertNull(result[0])
        assertNull(result[1])
        // TR[1] = max(108-98, |108-100|, |98-100|) = max(10, 8, 2) = 10
        // TR[2] = max(111-101, |111-103|, |101-103|) = max(10, 8, 2) = 10
        // ATR = (10+10)/2 = 10 -> then Wilder: (10*1+10)/2 = 10
        assertEquals(10.0, result[2]!!, 0.001)
    }

    @Test
    fun `ema seed is sma of first period`() {
        val candles = (1..5).map { candle(it.toDouble()) }
        val result = Indicators.ema(candles, 3)

        assertNull(result[0])
        assertNull(result[1])
        assertEquals(2.0, result[2]!!, 0.001) // SMA seed = (1+2+3)/3 = 2.0
    }

    @Test
    fun `sma handles single period`() {
        val candles = listOf(candle(42.0), candle(58.0))
        val result = Indicators.sma(candles, 1)
        assertEquals(42.0, result[0]!!, 0.001)
        assertEquals(58.0, result[1]!!, 0.001)
    }
}
