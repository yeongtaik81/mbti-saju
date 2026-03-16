package com.trading.app.domain.strategy

import com.trading.app.domain.model.Candle
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

object Indicators {

    /**
     * SMA (Simple Moving Average)
     * 단순 합산 방식 — 부동소수점 누적 오차 방지
     */
    fun sma(candles: List<Candle>, period: Int): List<Double?> {
        val result = MutableList<Double?>(candles.size) { null }
        if (period <= 0 || candles.size < period) return result

        for (i in (period - 1) until candles.size) {
            var sum = 0.0
            for (j in (i - period + 1)..i) {
                sum += candles[j].effectiveClose
            }
            result[i] = sum / period
        }
        return result
    }

    /**
     * EMA (Exponential Moving Average)
     * Seed: SMA(0..period-1), 이후 EMA = prev × (1-α) + close × α
     */
    fun ema(candles: List<Candle>, period: Int): List<Double?> {
        val result = MutableList<Double?>(candles.size) { null }
        if (period <= 0 || candles.size < period) return result

        var sum = 0.0
        for (i in 0 until period) {
            sum += candles[i].effectiveClose
        }
        var prev = sum / period
        result[period - 1] = prev

        val alpha = 2.0 / (period + 1)
        for (i in period until candles.size) {
            prev = prev * (1 - alpha) + candles[i].effectiveClose * alpha
            result[i] = prev
        }
        return result
    }

    /**
     * RSI (Relative Strength Index) — Wilder's smoothing
     * null 범위: [0..period]
     */
    fun rsi(candles: List<Candle>, period: Int): List<Double?> {
        val result = MutableList<Double?>(candles.size) { null }
        if (period <= 0 || candles.size < period + 1) return result

        val changes = mutableListOf<Double>()
        for (i in 1 until candles.size) {
            changes.add(candles[i].effectiveClose - candles[i - 1].effectiveClose)
        }

        var avgGain = 0.0
        var avgLoss = 0.0
        for (i in 0 until period) {
            val c = changes[i]
            if (c > 0) avgGain += c else avgLoss += abs(c)
        }
        avgGain /= period
        avgLoss /= period

        result[period] = calcRsi(avgGain, avgLoss)

        for (i in period until changes.size) {
            val change = changes[i]
            val gain = if (change > 0) change else 0.0
            val loss = if (change < 0) abs(change) else 0.0
            avgGain = (avgGain * (period - 1) + gain) / period
            avgLoss = (avgLoss * (period - 1) + loss) / period
            result[i + 1] = calcRsi(avgGain, avgLoss)
        }

        return result
    }

    /**
     * ATR (Average True Range) — Wilder's smoothing
     * null 범위: [0..period-1]
     */
    fun atr(candles: List<Candle>, period: Int): List<Double?> {
        val result = MutableList<Double?>(candles.size) { null }
        if (period <= 0 || candles.size < period + 1) return result

        val trValues = mutableListOf<Double>()
        for (i in 1 until candles.size) {
            val candle = candles[i]
            val prevClose = candles[i - 1].effectiveClose
            val tr = max(
                candle.high - candle.low,
                max(abs(candle.high - prevClose), abs(candle.low - prevClose))
            )
            trValues.add(tr)
        }

        var atrVal = 0.0
        for (i in 0 until period) {
            atrVal += trValues[i]
        }
        atrVal /= period
        result[period] = atrVal

        for (i in period until trValues.size) {
            atrVal = (atrVal * (period - 1) + trValues[i]) / period
            result[i + 1] = atrVal
        }

        return result
    }

    /**
     * Donchian Channel (shifted: 당일 미포함)
     * upper[i] = max(high[i-period..i-1])
     * lower[i] = min(low[i-period..i-1])
     * index < period → null
     */
    fun donchianUpper(candles: List<Candle>, period: Int): List<Double?> {
        val result = MutableList<Double?>(candles.size) { null }
        if (period <= 0) return result
        for (i in period until candles.size) {
            var maxHigh = Double.MIN_VALUE
            for (j in (i - period) until i) {
                maxHigh = max(maxHigh, candles[j].high)
            }
            result[i] = maxHigh
        }
        return result
    }

    fun donchianLower(candles: List<Candle>, period: Int): List<Double?> {
        val result = MutableList<Double?>(candles.size) { null }
        if (period <= 0) return result
        for (i in period until candles.size) {
            var minLow = Double.MAX_VALUE
            for (j in (i - period) until i) {
                minLow = min(minLow, candles[j].low)
            }
            result[i] = minLow
        }
        return result
    }

    private fun calcRsi(avgGain: Double, avgLoss: Double): Double {
        if (avgLoss == 0.0) return 100.0
        if (avgGain == 0.0) return 0.0
        return 100.0 - 100.0 / (1.0 + avgGain / avgLoss)
    }
}
