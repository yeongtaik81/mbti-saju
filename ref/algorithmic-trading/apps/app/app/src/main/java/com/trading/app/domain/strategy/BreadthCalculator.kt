package com.trading.app.domain.strategy

import androidx.sqlite.db.SimpleSQLiteQuery
import com.trading.app.data.local.db.dao.DailyCandleDao
import com.trading.app.domain.model.MarketRegime
import javax.inject.Inject

class BreadthCalculator @Inject constructor(
    private val candleDao: DailyCandleDao,
) {
    /**
     * 시장 breadth 계산: 전체 종목 중 close > N일 SMA인 비율
     * @return 0.0~1.0, 데이터 부족(<100 종목)이면 -1.0
     */
    suspend fun computeBreadth(date: String, maPeriod: Int = 20): Double {
        val minRequired = (maPeriod * 0.75).toInt()

        val sql = """
            WITH trading_dates AS (
                SELECT DISTINCT date FROM daily_candles
                WHERE date <= ? ORDER BY date DESC LIMIT ?
            ),
            stock_sma AS (
                SELECT dc.stock_code, AVG(dc.close) as sma_val
                FROM daily_candles dc
                JOIN trading_dates td ON dc.date = td.date
                GROUP BY dc.stock_code
                HAVING COUNT(*) >= ?
            ),
            latest_close AS (
                SELECT dc.stock_code, dc.close
                FROM daily_candles dc
                WHERE dc.date = (SELECT MAX(date) FROM trading_dates)
            )
            SELECT COUNT(*) as total,
                SUM(CASE WHEN lc.close > ss.sma_val THEN 1 ELSE 0 END) as above
            FROM latest_close lc
            JOIN stock_sma ss ON lc.stock_code = ss.stock_code
        """.trimIndent()

        val query = SimpleSQLiteQuery(sql, arrayOf(date, maPeriod, minRequired))
        val result = candleDao.rawQuery(query)

        if (result.total < 100) return -1.0
        return result.above.toDouble() / result.total
    }

    fun getRegime(
        breadth: Double,
        bullThreshold: Double = 0.50,
        bearThreshold: Double = 0.40,
    ): MarketRegime {
        if (breadth < 0) return MarketRegime.NEUTRAL
        return when {
            breadth >= bullThreshold -> MarketRegime.BULL
            breadth < bearThreshold -> MarketRegime.BEAR
            else -> MarketRegime.NEUTRAL
        }
    }
}
