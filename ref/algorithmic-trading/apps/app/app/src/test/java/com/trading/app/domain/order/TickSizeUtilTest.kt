package com.trading.app.domain.order

import org.junit.Assert.*
import org.junit.Test

class TickSizeUtilTest {

    @Test
    fun `tick size for price ranges`() {
        assertEquals(1, TickSizeUtil.getTickSize(1000.0))
        assertEquals(1, TickSizeUtil.getTickSize(2000.0))
        assertEquals(5, TickSizeUtil.getTickSize(2001.0))
        assertEquals(5, TickSizeUtil.getTickSize(5000.0))
        assertEquals(10, TickSizeUtil.getTickSize(5001.0))
        assertEquals(10, TickSizeUtil.getTickSize(20000.0))
        assertEquals(50, TickSizeUtil.getTickSize(20001.0))
        assertEquals(50, TickSizeUtil.getTickSize(50000.0))
        assertEquals(100, TickSizeUtil.getTickSize(50001.0))
        assertEquals(100, TickSizeUtil.getTickSize(200000.0))
        assertEquals(500, TickSizeUtil.getTickSize(200001.0))
        assertEquals(500, TickSizeUtil.getTickSize(500000.0))
        assertEquals(1000, TickSizeUtil.getTickSize(500001.0))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `throws for zero price`() {
        TickSizeUtil.getTickSize(0.0)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `throws for negative price`() {
        TickSizeUtil.getTickSize(-100.0)
    }

    @Test
    fun `adjustBuyPrice rounds down`() {
        assertEquals(72000, TickSizeUtil.adjustBuyPrice(72050.0))
        assertEquals(72000, TickSizeUtil.adjustBuyPrice(72099.0))
        assertEquals(72100, TickSizeUtil.adjustBuyPrice(72100.0))
    }

    @Test
    fun `adjustSellPrice rounds up`() {
        assertEquals(72100, TickSizeUtil.adjustSellPrice(72001.0))
        assertEquals(72000, TickSizeUtil.adjustSellPrice(72000.0))
    }
}
