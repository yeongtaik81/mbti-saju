package com.trading.app.data.local.db.dao

import androidx.room.*
import androidx.sqlite.db.SupportSQLiteQuery
import com.trading.app.data.local.db.entity.DailyCandleEntity

@Dao
interface DailyCandleDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(candles: List<DailyCandleEntity>)

    @Query("SELECT * FROM daily_candles WHERE stock_code = :stockCode ORDER BY date DESC LIMIT :limit")
    suspend fun getRecent(stockCode: String, limit: Int): List<DailyCandleEntity>

    @Query("SELECT * FROM daily_candles WHERE stock_code = :stockCode AND date >= :fromDate AND date <= :toDate ORDER BY date ASC")
    suspend fun getByDateRange(stockCode: String, fromDate: String, toDate: String): List<DailyCandleEntity>

    @Query("SELECT MAX(date) FROM daily_candles WHERE stock_code = :stockCode")
    suspend fun getLatestDate(stockCode: String): String?

    @Query("SELECT DISTINCT stock_code FROM daily_candles")
    suspend fun getAllStockCodes(): List<String>

    /** 거래일 수 계산 (fromDate exclusive, toDate inclusive) */
    @Query("SELECT COUNT(DISTINCT date) FROM daily_candles WHERE date > :fromDate AND date <= :toDate")
    suspend fun countTradingDaysSince(fromDate: String, toDate: String): Int

    @Query("SELECT MAX(date) FROM daily_candles")
    suspend fun getMaxDate(): String?

    @Query("DELETE FROM daily_candles WHERE date < :cutoffDate")
    suspend fun deleteOlderThan(cutoffDate: String)

    @Query("DELETE FROM daily_candles WHERE date >= :date")
    suspend fun deleteFromDate(date: String): Int

    /** 누락 데이터 보충용: 최신 날짜가 today보다 이전인 종목 목록 */
    @Query("""
        SELECT stock_code, MAX(date) as latest_date FROM daily_candles
        WHERE date >= :minDate
        GROUP BY stock_code HAVING MAX(date) < :today
        ORDER BY latest_date DESC
    """)
    suspend fun getStocksNeedingUpdate(today: String, minDate: String): List<StockGapInfo>

    data class StockGapInfo(
        @ColumnInfo(name = "stock_code") val stockCode: String,
        @ColumnInfo(name = "latest_date") val latestDate: String,
    )

    /** Breadth 계산용 raw query */
    @RawQuery
    suspend fun rawQuery(query: SupportSQLiteQuery): BreadthResult

    data class BreadthResult(
        val total: Int,
        val above: Int,
    )
}
